import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LLMCallConfig } from '@/domain/node-types';
import { streamChatCompletion } from '@/openrouter/client';
import type { ChatMessage } from '@/openrouter/types';
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

    const request = {
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens ?? undefined,
      response_format: cfg.responseFormat === 'json_object' ? { type: 'json_object' as const } : undefined,
    };
    ctx.details.request = request;

    const t0 = performance.now();
    let assembled = '';
    let usage = { input: 0, output: 0 };
    let firstTokenAtMs: number | null = null;

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
    });

    const totalMs = performance.now() - t0;
    ctx.details.response = { text };
    ctx.details.usage = usage;
    ctx.details.timing = { totalMs, firstTokenMs: firstTokenAtMs };

    const finalMessages: ChatMessage[] = [...messages, { role: 'assistant', content: text }];
    return { text, toolCalls: [], messages: finalMessages, usage };
  },
};

registerNodeDefinition(llmCallNode);
