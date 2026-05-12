import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolDefinitionPayload } from './tool';
import type { Context, ToolCall } from '@/openrouter/types';
import { runToolBatch } from './_internals/tool-batch';

export interface ToolRunResult {
  toolCallId: string; name: string; input: Record<string, unknown>;
  output?: unknown; error?: string; durationMs: number;
}

function flatten(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    const out: ToolDefinitionPayload[] = [];
    for (const item of input) Array.isArray(item) ? out.push(...item) : out.push(item as ToolDefinitionPayload);
    return out;
  }
  return [input as ToolDefinitionPayload];
}

export const toolRunnerNode: NodeDefinition = {
  type: 'tool-runner',
  inputPorts: ['toolCalls', 'tools', 'context'],
  outputPorts: ['context', 'results'],
  async run(_node, inputs, ctx) {
    const toolCalls = (inputs.toolCalls as ToolCall[] | undefined) ?? [];
    const tools = flatten(inputs.tools);
    const contextIn = (inputs.context as Context[] | undefined) ?? [];
    const { results, toolMessages } = await runToolBatch({ toolCalls, tools, signal: ctx.signal });
    ctx.details.results = results;
    return { context: [...contextIn, ...toolMessages], results };
  },
};

registerNodeDefinition(toolRunnerNode);
