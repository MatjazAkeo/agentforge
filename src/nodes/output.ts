import { registerNodeDefinition, type NodeDefinition } from './registry';
import { extractText, type Context } from '@/domain/context';

function isContextArray(v: unknown): v is Context[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  const first = v[0] as { role?: unknown } | undefined;
  return !!first && typeof first === 'object' && typeof first.role === 'string';
}

export const outputNode: NodeDefinition = {
  type: 'output',
  inputPorts: ['context'],
  outputPorts: [],
  async run(_node, inputs, ctx) {
    // Primary path: incoming is a Context[]; render the last message's text.
    // Fallback: anything else (a Loop Controller channel emitting a raw value
    // via the universal-json wire) gets stored as-is for the inspector.
    const incoming = inputs.context;
    ctx.details.value = isContextArray(incoming) ? extractText(incoming) : incoming;
    return {};
  },
};

registerNodeDefinition(outputNode);
