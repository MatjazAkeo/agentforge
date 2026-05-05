// src/sqlite/db-host.ts
//
// Owns one Web Worker per Tool Pack node. Wraps the postMessage protocol
// in a Promise-based API. Auto-correlates requests by monotonic id.

import DbWorker from './db-worker?worker';
import type { ColumnInfo, DbRequest, DbResponse, QueryResult } from './types';

export interface DbHost {
  init(bytes: ArrayBuffer): Promise<void>;
  reload(bytes: ArrayBuffer): Promise<void>;
  query(sql: string, params?: Record<string, unknown> | unknown[], maxRows?: number): Promise<QueryResult>;
  tables(): Promise<string[]>;
  columns(table: string): Promise<ColumnInfo[]>;
  export(): Promise<ArrayBuffer>;
  /** True after a successful init() or reload(). False before, or after dispose(). */
  isInitialized(): boolean;
  dispose(): void;
  /** Test-only — list of messages we posted to the worker. */
  posted(): unknown[];
}

const DEFAULT_MAX_ROWS = 1000;

export function createDbHost(): DbHost {
  const worker = new DbWorker();
  let nextId = 1;
  let initialized = false;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const posted: unknown[] = [];

  worker.onmessage = (e: MessageEvent<DbResponse>) => {
    const r = e.data;
    const p = pending.get(r.id);
    if (!p) return;
    pending.delete(r.id);
    if (r.ok) p.resolve(r.value);
    else p.reject(new Error(r.error));
  };

  type DbRequestBody = DbRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

  function send<T>(req: DbRequestBody): Promise<T> {
    const id = nextId++;
    const msg = { ...req, id } as DbRequest;
    posted.push(msg);
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage(msg);
    });
  }

  return {
    init: async (bytes) => {
      await send<void>({ op: 'init', bytes });
      initialized = true;
    },
    reload: async (bytes) => {
      await send<void>({ op: 'reload', bytes });
      initialized = true;
    },
    query: (sql, params, maxRows = DEFAULT_MAX_ROWS) =>
      send<QueryResult>({ op: 'query', sql, params, maxRows }),
    tables: () => send<string[]>({ op: 'tables' }),
    columns: (table) => send<ColumnInfo[]>({ op: 'columns', table }),
    export: () => send<ArrayBuffer>({ op: 'export' }),
    isInitialized: () => initialized,
    dispose: () => {
      initialized = false;
      worker.terminate();
    },
    posted: () => posted,
  };
}
