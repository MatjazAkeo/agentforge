import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { AgentConfig } from '@/domain/node-types';
import type { ChatMessage } from '@/openrouter/types';
import type { ToolDefinitionPayload } from './tool';
import { llmOnce } from './_internals/llm-once';
import { runToolBatch } from './_internals/tool-batch';
import { useRunStore } from '@/stores/run';

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

function buildInitialMessages(cfg: AgentConfig, inputs: Record<string, unknown>): ChatMessage[] {
  const upstream = inputs.messages;
  if (Array.isArray(upstream)) {
    if (cfg.systemPrompt && (upstream as ChatMessage[])[0]?.role !== 'system') {
      return [{ role: 'system', content: cfg.systemPrompt }, ...(upstream as ChatMessage[])];
    }
    return upstream as ChatMessage[];
  }
  const messages: ChatMessage[] = [];
  if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });
  const um = typeof inputs.userMessage === 'string' ? inputs.userMessage : '';
  if (um) messages.push({ role: 'user', content: um });
  return messages;
}

export const agentNode: NodeDefinition = {
  type: 'agent',
  inputPorts: ['messages', 'userMessage', 'tools'],
  outputPorts: ['text', 'messages', 'iterationCount'],
  async run(node, inputs, ctx) {
    const cfg = node.config as AgentConfig;
    const tools = flattenTools(inputs.tools);
    let messages = buildInitialMessages(cfg, inputs);
    const iterations: AgentIteration[] = [];
    let lastText = '';
    const runStore = useRunStore();

    for (let i = 1; i <= cfg.maxIterations; i++) {
      if (ctx.signal.aborted) throw new Error('aborted');
      runStore.incrementApiCalls();

      const llm = await llmOnce({
        apiKey: ctx.apiKey, signal: ctx.signal,
        model: cfg.model, temperature: cfg.temperature, maxTokens: cfg.maxTokens,
        responseFormat: null, messages, tools,
        onUsage: (u) => runStore.addTokens(u.input, u.output),
        onContentDelta: (d) => ctx.onStreamUpdate?.(d),
      });
      lastText = llm.text;
      const assistantMsg: ChatMessage = { role: 'assistant', content: llm.text };
      if (llm.toolCalls.length > 0) assistantMsg.tool_calls = llm.toolCalls;
      messages = [...messages, assistantMsg];

      if (llm.toolCalls.length === 0) {
        iterations.push({
          iteration: i,
          llm: { request: llm.request, response: llm.response, usage: llm.usage, timing: llm.timing },
          toolCalls: [], tools: [],
        });
        ctx.details.iterations = iterations;
        ctx.details.stopReason = 'final-answer';
        return { text: lastText, messages, iterationCount: i };
      }

      const batch = await runToolBatch({ toolCalls: llm.toolCalls, tools, signal: ctx.signal });
      messages = [...messages, ...batch.toolMessages];
      iterations.push({
        iteration: i,
        llm: { request: llm.request, response: llm.response, usage: llm.usage, timing: llm.timing },
        toolCalls: llm.toolCalls,
        tools: batch.results,
      });
      ctx.details.iterations = iterations;
    }

    ctx.details.stopReason = 'max-iterations';
    throw new Error(`Agent: maxIterations (${cfg.maxIterations}) exceeded without a final answer`);
  },
};

registerNodeDefinition(agentNode);
