import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { AgentConfig } from '@/domain/node-types';
import type { ChatMessage, ContentPart } from '@/openrouter/types';
import type { ImageRef } from '@/domain/images';
import type { ToolDefinitionPayload } from './tool';
import { llmOnce } from './_internals/llm-once';
import { runToolBatch } from './_internals/tool-batch';
import { resolveImagesToDataUrls } from './llm-call';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import { estimateCallCostUsd } from '@/openrouter/credits';

interface AgentIteration {
  iteration: number;
  llm: { request: unknown; response: { text: string }; usage: { input: number; output: number }; timing: { totalMs: number; firstTokenMs: number | null } };
  toolCalls: unknown[];
  tools: { name: string; input: Record<string, unknown>; output?: unknown; error?: string; durationMs: number }[];
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

function buildInitialMessages(
  cfg: AgentConfig,
  inputs: Record<string, unknown>,
  resolvedImages: string[],
): ChatMessage[] {
  const upstream = inputs.messages;
  // Multi-turn mode — messages wins (matches LLM Call precedence rule).
  if (Array.isArray(upstream)) {
    if (cfg.systemPrompt && (upstream as ChatMessage[])[0]?.role !== 'system') {
      return [{ role: 'system', content: cfg.systemPrompt }, ...(upstream as ChatMessage[])];
    }
    return upstream as ChatMessage[];
  }
  // One-shot mode — synthesize from text + resolvedImages.
  const messages: ChatMessage[] = [];
  if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });
  const userText = typeof inputs.text === 'string' ? inputs.text : '';
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

export const agentNode: NodeDefinition = {
  type: 'agent',
  inputPorts: ['messages', 'text', 'tools', 'images'],
  outputPorts: ['text', 'messages', 'iteration'],
  async run(node, inputs, ctx) {
    const cfg = node.config as AgentConfig;
    const tools = flattenTools(inputs.tools);
    const imageRefs = inputs.images as ImageRef[] | undefined;
    const resolvedImages = await resolveImagesToDataUrls(imageRefs, ctx.graphFilePath);
    let messages = buildInitialMessages(cfg, inputs, resolvedImages);
    const iterations: AgentIteration[] = [];
    let lastText = '';
    const runStore = useRunStore();

    for (let i = 1; i <= cfg.maxIterations; i++) {
      if (ctx.signal.aborted) throw new Error('aborted');
      runStore.incrementApiCalls();

      const iterStart = new Date().toISOString();
      // Snapshot the messages going into this turn so the IterationRecord shows the
      // ACTUAL conversation state, not a synthesized projection.
      const messagesIn = messages.slice();

      const llm = await llmOnce({
        apiKey: ctx.apiKey, signal: ctx.signal,
        model: cfg.model, temperature: cfg.temperature, maxTokens: cfg.maxTokens,
        responseFormat: null, messages, tools,
        onUsage: (u) => {
          runStore.addTokens(u.input, u.output);
          const model = useSettingsStore().models.find((m) => m.id === cfg.model);
          runStore.addCost(estimateCallCostUsd(model, u.input, u.output));
        },
        onContentDelta: (d) => ctx.onStreamUpdate?.(d),
      });
      lastText = llm.text;
      const assistantMsg: ChatMessage = { role: 'assistant', content: llm.text };
      if (llm.toolCalls.length > 0) assistantMsg.tool_calls = llm.toolCalls;
      messages = [...messages, assistantMsg];

      if (llm.toolCalls.length === 0) {
        const richRecord: AgentIteration = {
          iteration: i,
          llm: { request: llm.request, response: llm.response, usage: llm.usage, timing: llm.timing },
          toolCalls: [], tools: [],
        };
        iterations.push(richRecord);
        ctx.details.iterations = iterations;
        ctx.details.stopReason = 'final-answer';
        ctx.onIterationComplete?.({
          iteration: i,
          startedAt: iterStart,
          endedAt: new Date().toISOString(),
          inputs: { messages: messagesIn, tools: tools.map((t) => t.name) },
          output: { text: llm.text, toolCalls: [] },
          details: { llm: richRecord.llm, tools: [] },
        });
        return { text: lastText, messages, iteration: i };
      }

      const batch = await runToolBatch({ toolCalls: llm.toolCalls, tools, signal: ctx.signal });
      messages = [...messages, ...batch.toolMessages];
      const richRecord: AgentIteration = {
        iteration: i,
        llm: { request: llm.request, response: llm.response, usage: llm.usage, timing: llm.timing },
        toolCalls: llm.toolCalls,
        tools: batch.results,
      };
      iterations.push(richRecord);
      ctx.details.iterations = iterations;
      ctx.onIterationComplete?.({
        iteration: i,
        startedAt: iterStart,
        endedAt: new Date().toISOString(),
        inputs: { messages: messagesIn, tools: tools.map((t) => t.name) },
        output: { text: llm.text, toolCalls: llm.toolCalls, toolResults: batch.results },
        details: { llm: richRecord.llm, tools: batch.results },
      });
    }

    ctx.details.stopReason = 'max-iterations';
    throw new Error(`Agent: maxIterations (${cfg.maxIterations}) exceeded without a final answer`);
  },
};

registerNodeDefinition(agentNode);
