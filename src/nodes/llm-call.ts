import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LLMCallConfig } from '@/domain/node-types';
import type { Context, ContentPart } from '@/openrouter/types';
import type { ImageRef } from '@/domain/images';
import type { ToolDefinitionPayload } from './tool';
import { llmOnce } from './_internals/llm-once';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import { estimateCallCostUsd } from '@/openrouter/credits';
import { bytesToBase64 } from '@/files/image';
import { readAssetBytes } from '@/persistence/assets-dir';

function buildMessages(
  cfg: LLMCallConfig,
  inputs: { messages?: Context[]; text?: string; images?: ImageRef[] },
  resolvedImages: string[],
): Context[] {
  const upstream = inputs.messages;

  // Multi-turn mode — messages wins (ignores text + resolvedImages).
  if (Array.isArray(upstream)) {
    if (cfg.systemPrompt && upstream[0]?.role !== 'system') {
      return [{ role: 'system', content: cfg.systemPrompt }, ...upstream];
    }
    return upstream;
  }

  // One-shot mode — synthesize from text + resolvedImages.
  const userText = typeof inputs.text === 'string' ? inputs.text : '';
  const messages: Context[] = [];
  if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });

  if (resolvedImages.length === 0) {
    if (userText) messages.push({ role: 'user', content: userText });
  } else {
    const parts: ContentPart[] = [];
    if (userText) parts.push({ type: 'text', text: userText });
    for (const url of resolvedImages) parts.push({ type: 'image_url', image_url: { url } });
    messages.push({ role: 'user', content: parts });
  }
  return messages;
}

export async function resolveImagesToDataUrls(
  refs: ImageRef[] | undefined,
  graphFilePath: string | null,
): Promise<string[]> {
  if (!refs || refs.length === 0) return [];
  return Promise.all(refs.map(async (ref) => {
    if (ref.kind === 'inline') return ref.dataUrl;
    if (!graphFilePath) throw new Error('cannot resolve asset image — graph not saved');
    const bytes = await readAssetBytes(graphFilePath, ref.filename);
    return `data:${ref.mime};base64,${bytesToBase64(new Uint8Array(bytes))}`;
  }));
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
    const refs = inputs.images as ImageRef[] | undefined;
    const resolved = await resolveImagesToDataUrls(refs, ctx.graphFilePath);
    const messages = buildMessages(
      cfg,
      inputs as { messages?: Context[]; text?: string; images?: ImageRef[] },
      resolved,
    );
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
      text: out.text,
      toolCalls: out.toolCalls,
      messages: [...messages, assistantMessage],
      usage: out.usage,
    };
  },
};

registerNodeDefinition(llmCallNode);

export const buildMessagesForTest = buildMessages;
