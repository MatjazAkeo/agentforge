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
  const userText = typeof inputs.text === 'string' ? inputs.text : '';
  if (userText) messages.push({ role: 'user', content: userText });
  return messages;
}

export const agentNode: NodeDefinition = {
  type: 'agent',
  inputPorts: ['messages', 'text', 'tools'],
  outputPorts: ['text', 'messages', 'iteration'],
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

      const iterStart = new Date().toISOString();
      // Snapshot the messages going into this turn so the IterationRecord shows the
      // ACTUAL conversation state, not a synthesized projection.
      const messagesIn = messages.slice();

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
