// src/sqlite/types.ts
//
// Wire format between the main-thread DbHost and its dedicated DB worker.
// Every request carries an id; the response with the matching id resolves
// the host-side promise.

export interface ColumnInfo {
  name: string;
  type: string;
  pk: boolean;
  notnull: boolean;
}

export interface QueryResult {
  rows: Array<Record<string, unknown>>;
  /** True if the row count exceeded `maxRows` and was truncated. */
  truncated: boolean;
  /** Set for INSERT/UPDATE/DELETE — number of rows changed. */
  rowsAffected?: number;
}

export type DbRequest =
  | { id: number; op: 'init'; bytes: ArrayBuffer }
  | { id: number; op: 'query'; sql: string; params?: Record<string, unknown> | unknown[]; maxRows: number }
  | { id: number; op: 'tables' }
  | { id: number; op: 'columns'; table: string }
  | { id: number; op: 'export' }
  | { id: number; op: 'reload'; bytes: ArrayBuffer };

export type DbResponse =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string };
