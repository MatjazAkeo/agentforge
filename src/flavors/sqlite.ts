// src/flavors/sqlite.ts
import { dbRegistry } from '@/sqlite/db-registry';
import { readAssetBytes } from '@/persistence/assets-dir';
import { registerFlavor, type ToolPackFlavorBase } from './registry';

export interface SqliteConnection {
  /** Basename in <graph>.assets/. May have a -2/-3 suffix on collision. */
  db: string;
  /** Recorded at attach time, display only. */
  sourcePath?: string;
  /** Recorded at attach time, used for the 100 MB guardrail. */
  sizeBytes: number;
}

const DEFAULT_MAX_ROWS = 1000;

/**
 * Build a `sqlite` helper for a tool body. Initializes the persistent DbHost
 * for this Tool Pack node if it doesn't already exist, then returns method
 * proxies that forward into it.
 */
async function buildHelper(
  connection: SqliteConnection,
  ...rest: unknown[]
): Promise<{ [m: string]: (...a: unknown[]) => Promise<unknown> }> {
  const [nodeId, graphFilePath, maxRowsArg] = rest as [string, string | null, number | undefined];
  if (!graphFilePath) {
    throw new Error('tool-pack: save the graph first — SQLite Tool Packs need a saved location to find their side-car .db.');
  }
  const maxRows = maxRowsArg ?? DEFAULT_MAX_ROWS;
  const host = dbRegistry.getOrCreate(nodeId);
  const bytes = await readAssetBytes(graphFilePath, connection.db);
  await host.init(bytes);
  return {
    query: (sql: unknown, params?: unknown) =>
      host.query(sql as string, params as Record<string, unknown> | unknown[] | undefined, maxRows),
    tables: () => host.tables(),
    columns: (table: unknown) => host.columns(table as string),
  };
}

export const sqliteFlavor: ToolPackFlavorBase<SqliteConnection> = {
  type: 'sqlite',
  helperName: 'sqlite',
  defaultConnection: { db: '', sourcePath: undefined, sizeBytes: 0 },
  buildHelper,
};

registerFlavor(sqliteFlavor);
