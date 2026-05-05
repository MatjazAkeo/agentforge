// src/sqlite/db-registry.ts
//
// Per-Tool-Pack-node-id → DbHost. The DB worker is created when first
// requested (typically at attach time, or on first run) and lives until
// the node is deleted, the graph is closed, or the app exits.

import { createDbHost, type DbHost } from './db-host';

const hosts = new Map<string, DbHost>();

export const dbRegistry = {
  getOrCreate(nodeId: string): DbHost {
    let h = hosts.get(nodeId);
    if (!h) {
      h = createDbHost();
      hosts.set(nodeId, h);
    }
    return h;
  },
  get(nodeId: string): DbHost | undefined {
    return hosts.get(nodeId);
  },
  dispose(nodeId: string): void {
    const h = hosts.get(nodeId);
    if (!h) return;
    h.dispose();
    hosts.delete(nodeId);
  },
  disposeAll(): void {
    for (const h of hosts.values()) h.dispose();
    hosts.clear();
  },
  /** Test helper — list of currently-tracked node ids. */
  ids(): string[] {
    return [...hosts.keys()];
  },
};
