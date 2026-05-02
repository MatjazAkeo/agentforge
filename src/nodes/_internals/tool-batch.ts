import type { ChatMessage, ToolCall } from '@/openrouter/types';
import type { ToolDefinitionPayload } from '../tool';
import { runInSandbox } from '@/sandbox/runner';
import type { ToolRunResult } from '../tool-runner';

export interface ToolBatchArgs {
  toolCalls: ToolCall[];
  tools: ToolDefinitionPayload[];
  signal: AbortSignal;
}

export interface ToolBatchResult {
  results: ToolRunResult[];
  toolMessages: ChatMessage[];
}

export async function runToolBatch(args: ToolBatchArgs): Promise<ToolBatchResult> {
  const byName = new Map(args.tools.map((t) => [t.name, t]));
  const results: ToolRunResult[] = [];
  await Promise.all(args.toolCalls.map(async (call) => {
    const def = byName.get(call.function.name);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(call.function.arguments || '{}'); } catch { /* leave empty */ }
    if (!def) {
      results.push({ toolCallId: call.id, name: call.function.name, input: parsed, error: 'tool not found', durationMs: 0 });
      return;
    }
    const sb = await runInSandbox({ code: def.code, inputs: parsed, timeoutMs: def.timeoutMs, signal: args.signal });
    if (sb.kind === 'ok') results.push({ toolCallId: call.id, name: call.function.name, input: parsed, output: sb.value, durationMs: sb.durationMs });
    else results.push({ toolCallId: call.id, name: call.function.name, input: parsed, error: sb.message, durationMs: sb.durationMs });
  }));
  const toolMessages: ChatMessage[] = results.map((r) => ({
    role: 'tool', tool_call_id: r.toolCallId, name: r.name,
    content: r.error ? `Error: ${r.error}` : String(r.output ?? ''),
  }));
  return { results, toolMessages };
}
