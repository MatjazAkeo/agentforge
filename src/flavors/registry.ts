// src/flavors/registry.ts
//
// Generic registry for Tool Pack flavors. Each flavor knows how to build a
// helper object that gets bound into the user's tool JS scope.

import type { Component } from 'vue';

export interface ToolPackFlavorBase<TConnection> {
  /** Stable identifier persisted in node config. */
  type: string;
  /** Default connection object when a fresh Tool Pack is created with this flavor. */
  defaultConnection: TConnection;
  /** Name of the helper bound into each tool's JS scope (e.g. 'sqlite'). */
  helperName: string;
  /** Build the helper for runtime use against this connection. May be async.
   *  The signature is intentionally variadic so flavors can pass extra
   *  flavor-specific args (the SQLite flavor takes nodeId + graphFilePath
   *  + maxRows; future flavors might take other things). */
  buildHelper: (
    connection: TConnection,
    ...rest: unknown[]
  ) => Promise<{ [methodName: string]: (...args: unknown[]) => Promise<unknown> }>;
  /** Optional: bespoke Vue component for the connection panel. */
  inspectorPanel?: Component;
}

const flavors = new Map<string, ToolPackFlavorBase<unknown>>();

export function registerFlavor<TConnection>(flavor: ToolPackFlavorBase<TConnection>): void {
  flavors.set(flavor.type, flavor as ToolPackFlavorBase<unknown>);
}

export function getFlavor(type: string): ToolPackFlavorBase<unknown> | undefined {
  return flavors.get(type);
}

export function listFlavors(): ToolPackFlavorBase<unknown>[] {
  return [...flavors.values()];
}
