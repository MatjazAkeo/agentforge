import type { ChatMessage, ToolCall } from '@/openrouter/types';
import type { ToolDefinitionPayload } from '../tool';
import { runInSandbox, type SandboxHelpers } from '@/sandbox/runner';
import type { ToolRunResult } from '../tool-runner';
import { toolPackHelperFactories } from '../tool-pack';

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
    // If this tool came from a Tool Pack node, its toolId is `<nodeId>/<name>`.
    // Look up the registered factory and bind the flavor's helper into the
    // sandbox scope before executing the user code.
    const packNodeId = def.toolId.includes('/') ? def.toolId.split('/')[0] : null;
    const factory = packNodeId ? toolPackHelperFactories.get(packNodeId) : undefined;
    let helpers: SandboxHelpers | undefined;
    if (factory) {
      const built = await factory(def.name);
      helpers = { [built.name]: built.impl };
    }
    const sb = await runInSandbox({ code: def.code, inputs: parsed, timeoutMs: def.timeoutMs, signal: args.signal, helpers });
    if (sb.kind === 'ok') results.push({ toolCallId: call.id, name: call.function.name, input: parsed, output: sb.value, durationMs: sb.durationMs });
    else results.push({ toolCallId: call.id, name: call.function.name, input: parsed, error: sb.message, durationMs: sb.durationMs });
  }));
  const toolMessages: ChatMessage[] = results.map((r) => ({
    role: 'tool', tool_call_id: r.toolCallId, name: r.name,
    // Serialize structured outputs as JSON so the LLM sees the actual data
    // instead of "[object Object]". Strings pass through verbatim.
    content: r.error
      ? `Error: ${r.error}`
      : typeof r.output === 'string'
        ? r.output
        : JSON.stringify(r.output ?? null),
  }));
  return { results, toolMessages };
}
