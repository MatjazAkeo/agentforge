import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LLMCallConfig } from '@/domain/node-types';
import type { Context } from '@/openrouter/types';
import type { ToolDefinitionPayload } from './tool';
import { llmOnce } from './_internals/llm-once';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import { estimateCallCostUsd } from '@/openrouter/credits';

function flattenTools(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    const out: ToolDefinitionPayload[] = [];
    for (const item of input) Array.isArray(item) ? out.push(...item) : out.push(item as ToolDefinitionPayload);
    return out;
  }
  return [input as ToolDefinitionPayload];
}

// Prepend the configured systemPrompt only if the incoming context doesn't
// already start with a system message (avoids double-systems when the upstream
// already injected one).
function buildMessages(cfg: LLMCallConfig, contextIn: Context[] | undefined): Context[] {
  const upstream = contextIn ?? [];
  if (cfg.systemPrompt && upstream[0]?.role !== 'system') {
    return [{ role: 'system', content: cfg.systemPrompt }, ...upstream];
  }
  return upstream;
}

export const llmCallNode: NodeDefinition = {
  type: 'llm-call',
  inputPorts: ['context', 'tools'],
  outputPorts: ['context', 'toolCalls', 'usage'],
  async run(node, inputs, ctx) {
    const cfg = node.config as LLMCallConfig;
    const incoming = inputs.context as Context[] | undefined;
    const messages = buildMessages(cfg, incoming);
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

    const assistantMessage: Context = { role: 'assistant', content: out.text };
    if (out.toolCalls.length > 0) assistantMessage.tool_calls = out.toolCalls;
    return {
      context: [...messages, assistantMessage],
      toolCalls: out.toolCalls,
      usage: out.usage,
    };
  },
};

registerNodeDefinition(llmCallNode);
