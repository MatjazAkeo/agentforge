// src/sqlite/db-worker.ts
//
// Persistent Web Worker per Tool Pack node. Lazy-imports sql.js the first
// time it receives an `init`. Holds the parsed Database in memory across
// many query messages.

import type { DbRequest, DbResponse, QueryResult, ColumnInfo } from './types';
// Vite resolves the `?url` suffix to a built asset URL, so sql.js can find
// its WASM blob regardless of where the worker bundle ends up. Without this
// sql.js tries a relative fetch that 404s in dev and breaks in prod.
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

interface SqlJsDatabase {
  exec(sql: string, params?: Record<string, unknown> | unknown[]): Array<{
    columns: string[];
    values: unknown[][];
  }>;
  getRowsModified(): number;
  export(): Uint8Array;
  close(): void;
}

interface SqlJs {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

let SQL: SqlJs | null = null;
let db: SqlJsDatabase | null = null;

async function ensureSql(): Promise<SqlJs> {
  if (SQL) return SQL;
  // @ts-expect-error sql.js types are not aligned with our minimal interface
  const initSqlJs = (await import('sql.js')).default;
  SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  return SQL!;
}

function rowsFromExec(result: Array<{ columns: string[]; values: unknown[][] }>): Array<Record<string, unknown>> {
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((c, i) => { obj[c] = row[i]; });
    return obj;
  });
}

async function handle(req: DbRequest): Promise<unknown> {
  switch (req.op) {
    case 'init':
    case 'reload': {
      const sql = await ensureSql();
      if (db) db.close();
      db = new sql.Database(new Uint8Array(req.bytes));
      return null;
    }
    case 'query': {
      if (!db) throw new Error('DB not initialized');
      const result = db.exec(req.sql, req.params);
      const rows = rowsFromExec(result);
      const out: QueryResult = {
        rows: rows.length > req.maxRows ? rows.slice(0, req.maxRows) : rows,
        truncated: rows.length > req.maxRows,
      };
      const affected = db.getRowsModified();
      if (affected > 0) out.rowsAffected = affected;
      return out;
    }
    case 'tables': {
      if (!db) throw new Error('DB not initialized');
      const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
      return r.length > 0 ? r[0].values.map((v) => String(v[0])) : [];
    }
    case 'columns': {
      if (!db) throw new Error('DB not initialized');
      const r = db.exec(`PRAGMA table_info(${JSON.stringify(req.table)})`);
      if (r.length === 0) return [];
      return r[0].values.map((v): ColumnInfo => ({
        name: String(v[1]),
        type: String(v[2]),
        notnull: Number(v[3]) === 1,
        pk: Number(v[5]) > 0,
      }));
    }
    case 'export': {
      if (!db) throw new Error('DB not initialized');
      return db.export().buffer;
    }
  }
}

self.onmessage = async (e: MessageEvent<DbRequest>) => {
  const req = e.data;
  try {
    const value = await handle(req);
    const resp: DbResponse = { id: req.id, ok: true, value };
    if (req.op === 'export' && value instanceof ArrayBuffer) {
      (self as unknown as Worker).postMessage(resp, [value]);
    } else {
      self.postMessage(resp);
    }
  } catch (err) {
    const resp: DbResponse = { id: req.id, ok: false, error: (err as Error).message };
    self.postMessage(resp);
  }
};
