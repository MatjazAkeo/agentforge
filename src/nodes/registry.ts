import type { Node } from '@/domain/graph';
import type { NodeType } from '@/domain/node-types';
import type { IterationRecord } from '@/domain/run';
import type { ChatMessage } from '@/openrouter/types';

export type RunInputs = Record<string, unknown>;
export type RunOutputs = Record<string, unknown>;

export interface ChatSession {
  /** The just-submitted user message text. */
  userMessage: string;
  /** Full chat history including the latest user message at the end. */
  history: ChatMessage[];
}

export interface NodeRunContext {
  signal: AbortSignal;
  details: Record<string, unknown>;
  onStreamUpdate?: (preview: string) => void;
  /**
   * Called by nodes that run an internal multi-step process (e.g. Agent's LLM↔tool loop).
   * The runner appends each record to `result.iterations[]`, so the inspector's
   * canonical iteration tree can render it. Optional — single-pass nodes ignore it.
   */
  onIterationComplete?: (record: IterationRecord) => void;
  /** Set by the runner when the run was triggered by a chat-sidebar submission. */
  chatSession?: ChatSession;
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
