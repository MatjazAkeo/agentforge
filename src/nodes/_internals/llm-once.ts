import type { Context, ToolCall } from '@/openrouter/types';
import { streamChatCompletion } from '@/openrouter/client';
import type { ToolDefinitionPayload } from '../tool';

export interface LLMOnceArgs {
  apiKey: string;
  signal: AbortSignal;
  model: string;
  temperature: number;
  maxTokens?: number | null;
  responseFormat?: 'text' | 'json_object' | null;
  messages: Context[];
  tools: ToolDefinitionPayload[];
  onContentDelta?: (delta: string) => void;
  onUsage?: (u: { input: number; output: number }) => void;
}

export interface LLMOnceResult {
  text: string;
  toolCalls: ToolCall[];
  request: unknown;
  response: { text: string };
  usage: { input: number; output: number };
  timing: { totalMs: number; firstTokenMs: number | null };
}

export async function llmOnce(args: LLMOnceArgs): Promise<LLMOnceResult> {
  const requestTools = args.tools.length > 0
    ? args.tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.inputSchema } }))
    : undefined;
  const request = {
    model: args.model,
    messages: args.messages,
    temperature: args.temperature,
    max_tokens: args.maxTokens ?? undefined,
    response_format: args.responseFormat === 'json_object' ? { type: 'json_object' as const } : undefined,
    tools: requestTools,
    parallel_tool_calls: requestTools ? true : undefined,
  };
  const t0 = performance.now();
  let firstTokenAtMs: number | null = null;
  let assembled = '';
  let usage = { input: 0, output: 0 };
  let captured: ToolCall[] = [];
  await streamChatCompletion({
    apiKey: args.apiKey, request, signal: args.signal,
    onContentDelta: (d) => { if (firstTokenAtMs === null) firstTokenAtMs = performance.now() - t0; assembled += d; args.onContentDelta?.(d); },
    onUsage: (u) => { usage = { input: u.input, output: u.output }; args.onUsage?.(usage); },
    onToolCalls: (calls) => { captured = calls; },
  });
  return {
    text: assembled,
    toolCalls: captured,
    request,
    response: { text: assembled },
    usage,
    timing: { totalMs: performance.now() - t0, firstTokenMs: firstTokenAtMs },
  };
}
