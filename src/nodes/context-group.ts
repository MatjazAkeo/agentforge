import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { Context } from '@/domain/context';
import { mergeContextsMergeLastUser } from '@/domain/context';

function flattenContexts(input: unknown): Context[][] {
  if (!input) return [];
  if (!Array.isArray(input)) return [];
  if (input.length === 0) return [];
  if (Array.isArray(input[0])) return input as Context[][];
  return [input as Context[]];
}

export const contextGroupNode: NodeDefinition = {
  type: 'context-group',
  inputPorts: ['contexts'],
  outputPorts: ['context'],
  async run(_node, inputs, ctx) {
    const incoming = flattenContexts(inputs.contexts);
    const merged = mergeContextsMergeLastUser(incoming, ctx.details);
    ctx.details.inputCount = incoming.length;
    ctx.details.outputLength = merged.length;
    return { context: merged };
  },
};

registerNodeDefinition(contextGroupNode);
