// src/nodes/tool-group.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolDefinitionPayload } from './tool';

function flatten(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    // Could be a flat array of payloads, or an array of arrays (multi-edge fan-in).
    const out: ToolDefinitionPayload[] = [];
    for (const item of input) {
      if (Array.isArray(item)) out.push(...(item as ToolDefinitionPayload[]));
      else out.push(item as ToolDefinitionPayload);
    }
    return out;
  }
  return [input as ToolDefinitionPayload];
}

export const toolGroupNode: NodeDefinition = {
  type: 'tool-group',
  inputPorts: ['tools'],
  outputPorts: ['toolDefinition'],
  async run(_node, inputs, ctx) {
    const aggregated = flatten(inputs.tools);

    // Validate: tool names must be unique across the group.
    const seen = new Set<string>();
    const conflicts: string[] = [];
    for (const t of aggregated) {
      if (seen.has(t.name)) conflicts.push(t.name);
      seen.add(t.name);
    }
    if (conflicts.length > 0) {
      throw new Error(`Duplicate tool names in group: ${conflicts.join(', ')}`);
    }

    ctx.details.members = aggregated.map((t) => ({ name: t.name, description: t.description }));
    return { toolDefinition: aggregated };
  },
};

registerNodeDefinition(toolGroupNode);
