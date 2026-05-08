// src/flavors/none.ts
//
// "Plain" flavor for Tool Pack — no backend connection, no helper bound into
// tool scope. Lets users author a batch of tools in a single node without
// the DB attach ceremony when they don't need persistence.

import { registerFlavor, type ToolPackFlavorBase } from './registry';

export type NoneConnection = Record<string, never>;

export const noneFlavor: ToolPackFlavorBase<NoneConnection> = {
  type: 'none',
  // Empty helperName signals "skip helper binding" to the Tool Pack runner.
  helperName: '',
  defaultConnection: {},
  async buildHelper() {
    return {};
  },
};

registerFlavor(noneFlavor);
