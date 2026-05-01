import type { Node } from '@/domain/graph';
import type { NodeType } from '@/domain/node-types';

export type RunInputs = Record<string, unknown>;
export type RunOutputs = Record<string, unknown>;

export interface NodeRunContext {
  signal: AbortSignal;
  details: Record<string, unknown>;
  onStreamUpdate?: (preview: string) => void;
  apiKey: string;
}

export interface NodeDefinition {
  type: NodeType;
  inputPorts: string[];
  outputPorts: string[];
  run: (node: Node, inputs: RunInputs, ctx: NodeRunContext) => Promise<RunOutputs>;
}

const definitions = new Map<NodeType, NodeDefinition>();

export function registerNodeDefinition(def: NodeDefinition) {
  definitions.set(def.type, def);
}

export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
  return definitions.get(type);
}
