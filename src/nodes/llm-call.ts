import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LLMCallConfig } from '@/domain/node-types';
import { streamChatCompletion } from '@/openrouter/client';
import type { ChatMessage, ToolCall } from '@/openrouter/types';
import type { ToolDefinitionPayload } from './tool';
import { useRunStore } from '@/stores/run';

function buildMessages(cfg: LLMCallConfig, inputs: Record<string, unknown>): ChatMessage[] {
  const upstream = inputs.messages;
  if (Array.isArray(upstream)) {
    if (cfg.systemPrompt && (upstream as ChatMessage[])[0]?.role !== 'system') {
      return [{ role: 'system', content: cfg.systemPrompt }, ...(upstream as ChatMessage[])];
    }
    return upstream as ChatMessage[];
  }
  const userMessage = typeof inputs.userMessage === 'string' ? inputs.userMessage : '';
  const messages: ChatMessage[] = [];
  if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });
  if (userMessage) messages.push({ role: 'user', content: userMessage });
  return messages;
}

export const llmCallNode: NodeDefinition = {
  type: 'llm-call',
  inputPorts: ['messages', 'userMessage', 'tools'],
  outputPorts: ['text', 'toolCalls', 'messages', 'usage'],
  async run(node, inputs, ctx) {
    const cfg = node.config as LLMCallConfig;
    const messages = buildMessages(cfg, inputs);

    const toolsInput = inputs.tools as ToolDefinitionPayload[] | ToolDefinitionPayload[][] | ToolDefinitionPayload | undefined;

    // Flatten potential array-of-arrays from multi-edge fan-in via Tool Group
    const flatTools: ToolDefinitionPayload[] = [];
    if (Array.isArray(toolsInput)) {
      for (const item of toolsInput) {
        if (Array.isArray(item)) flatTools.push(...item);
        else flatTools.push(item as ToolDefinitionPayload);
      }
    } else if (toolsInput) {
      flatTools.push(toolsInput as ToolDefinitionPayload);
    }

    const requestTools = flatTools.length > 0
      ? flatTools.map((t) => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        }))
      : undefined;

    const request = {
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens ?? undefined,
      response_format: cfg.responseFormat === 'json_object' ? { type: 'json_object' as const } : undefined,
      tools: requestTools,
      // Hint to providers that honor it (OpenAI-compatible). Many free providers
      // ignore this and emit one call per turn regardless — that's a model-side decision.
      parallel_tool_calls: requestTools ? true : undefined,
    };
    ctx.details.request = request;

    const t0 = performance.now();
    let assembled = '';
    let usage = { input: 0, output: 0 };
    let firstTokenAtMs: number | null = null;
    let capturedToolCalls: ToolCall[] = [];

    useRunStore().incrementApiCalls();

    const text = await streamChatCompletion({
      apiKey: ctx.apiKey,
      request,
      signal: ctx.signal,
      onContentDelta: (chunk) => {
        if (firstTokenAtMs === null) firstTokenAtMs = performance.now() - t0;
        assembled += chunk;
        const preview = assembled.length > 80 ? `…${assembled.slice(-80)}` : assembled;
        ctx.onStreamUpdate?.(preview);
      },
      onUsage: (u) => {
        usage = { input: u.input, output: u.output };
        useRunStore().addTokens(u.input, u.output);
      },
      onToolCalls: (calls) => {
        capturedToolCalls = calls;
      },
    });

    const totalMs = performance.now() - t0;
    ctx.details.response = { text };
    ctx.details.usage = usage;
    ctx.details.timing = { totalMs, firstTokenMs: firstTokenAtMs };
    ctx.details.toolCalls = capturedToolCalls;

    // Preserve tool_calls on the assistant turn — required by the OpenAI/OpenRouter
    // spec so the subsequent `tool` messages (which carry tool_call_id) are valid.
    const assistantMessage: ChatMessage = { role: 'assistant', content: text };
    if (capturedToolCalls.length > 0) assistantMessage.tool_calls = capturedToolCalls;
    const finalMessages: ChatMessage[] = [...messages, assistantMessage];
    return { text, toolCalls: capturedToolCalls, messages: finalMessages, usage };
  },
};

registerNodeDefinition(llmCallNode);
