import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LLMCallConfig } from '@/domain/node-types';
import type { ChatMessage } from '@/openrouter/types';
import type { ToolDefinitionPayload } from './tool';
import { llmOnce } from './_internals/llm-once';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import { estimateCallCostUsd } from '@/openrouter/credits';

function buildMessages(cfg: LLMCallConfig, inputs: Record<string, unknown>): ChatMessage[] {
  const upstream = inputs.messages;
  if (Array.isArray(upstream)) {
    if (cfg.systemPrompt && (upstream as ChatMessage[])[0]?.role !== 'system') {
      return [{ role: 'system', content: cfg.systemPrompt }, ...(upstream as ChatMessage[])];
    }
    return upstream as ChatMessage[];
  }
  const userText = typeof inputs.text === 'string' ? inputs.text : '';
  const messages: ChatMessage[] = [];
  if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });
  if (userText) messages.push({ role: 'user', content: userText });
  return messages;
}

function flattenTools(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    const out: ToolDefinitionPayload[] = [];
    for (const item of input) Array.isArray(item) ? out.push(...item) : out.push(item as ToolDefinitionPayload);
    return out;
  }
  return [input as ToolDefinitionPayload];
}

export const llmCallNode: NodeDefinition = {
  type: 'llm-call',
  inputPorts: ['messages', 'text', 'tools'],
  outputPorts: ['text', 'toolCalls', 'messages', 'usage'],
  async run(node, inputs, ctx) {
    const cfg = node.config as LLMCallConfig;
    const messages = buildMessages(cfg, inputs);
    const tools = flattenTools(inputs.tools);
    useRunStore().incrementApiCalls();

    const out = await llmOnce({
      apiKey: ctx.apiKey, signal: ctx.signal,
      model: cfg.model, temperature: cfg.temperature, maxTokens: cfg.maxTokens, responseFormat: cfg.responseFormat,
      messages, tools,
      onContentDelta: (d) => {
        const preview = ((ctx.details.responseTextSoFar as string | undefined) ?? '') + d;
        ctx.details.responseTextSoFar = preview;
        ctx.onStreamUpdate?.(preview.length > 80 ? `…${preview.slice(-80)}` : preview);
      },
      onUsage: (u) => {
        const runStore = useRunStore();
        runStore.addTokens(u.input, u.output);
        const model = useSettingsStore().models.find((m) => m.id === cfg.model);
        runStore.addCost(estimateCallCostUsd(model, u.input, u.output));
      },
    });

    ctx.details.request = out.request;
    ctx.details.response = out.response;
    ctx.details.usage = out.usage;
    ctx.details.timing = out.timing;
    ctx.details.toolCalls = out.toolCalls;

    const assistantMessage: ChatMessage = { role: 'assistant', content: out.text };
    if (out.toolCalls.length > 0) assistantMessage.tool_calls = out.toolCalls;
    return {
      text: out.text,
      toolCalls: out.toolCalls,
      messages: [...messages, assistantMessage],
      usage: out.usage,
    };
  },
};

registerNodeDefinition(llmCallNode);
