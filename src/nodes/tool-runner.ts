// src/nodes/tool-runner.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolDefinitionPayload } from './tool';
import type { ChatMessage, ToolCall } from '@/openrouter/types';
import { runInSandbox } from '@/sandbox/runner';

export interface ToolRunResult {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  durationMs: number;
}

function flatten(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    const out: ToolDefinitionPayload[] = [];
    for (const item of input) {
      if (Array.isArray(item)) out.push(...(item as ToolDefinitionPayload[]));
      else out.push(item as ToolDefinitionPayload);
    }
    return out;
  }
  return [input as ToolDefinitionPayload];
}

export const toolRunnerNode: NodeDefinition = {
  type: 'tool-runner',
  inputPorts: ['toolCalls', 'tools', 'messages'],
  outputPorts: ['messages', 'results'],
  async run(_node, inputs, ctx) {
    const toolCalls = (inputs.toolCalls as ToolCall[] | undefined) ?? [];
    const tools = flatten(inputs.tools);
    const messagesIn = (inputs.messages as ChatMessage[] | undefined) ?? [];

    const byName = new Map(tools.map((t) => [t.name, t]));
    const results: ToolRunResult[] = [];
    const newMessages: ChatMessage[] = [...messagesIn];

    // Execute all tool calls in parallel — the LLM emitted them as a batch.
    await Promise.all(
      toolCalls.map(async (call) => {
        const def = byName.get(call.function.name);
        let parsedInput: Record<string, unknown> = {};
        try { parsedInput = JSON.parse(call.function.arguments || '{}'); } catch { /* leave empty */ }

        if (!def) {
          results.push({ toolCallId: call.id, name: call.function.name, input: parsedInput, error: 'tool not found', durationMs: 0 });
          return;
        }

        const sb = await runInSandbox({
          code: def.code,
          inputs: parsedInput,
          timeoutMs: def.timeoutMs,
          signal: ctx.signal,
        });

        if (sb.kind === 'ok') {
          results.push({ toolCallId: call.id, name: call.function.name, input: parsedInput, output: sb.value, durationMs: sb.durationMs });
        } else {
          results.push({ toolCallId: call.id, name: call.function.name, input: parsedInput, error: sb.message, durationMs: sb.durationMs });
        }
      }),
    );

    // Append `tool` role messages so the next LLM call has the results in conversation.
    for (const r of results) {
      newMessages.push({
        role: 'tool',
        tool_call_id: r.toolCallId,
        name: r.name,
        content: r.error ? `Error: ${r.error}` : String(r.output ?? ''),
      });
    }

    ctx.details.results = results;
    return { messages: newMessages, results };
  },
};

registerNodeDefinition(toolRunnerNode);
