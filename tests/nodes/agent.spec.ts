import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { agentNode } from '@/nodes/agent';
import type { Node } from '@/domain/graph';
import * as llmOnceModule from '@/nodes/_internals/llm-once';
import * as toolBatchModule from '@/nodes/_internals/tool-batch';

function makeAgent(): Node {
  return {
    id: 'a', type: 'agent', position: { x: 0, y: 0 },
    config: {
      model: 'm', systemPrompt: '', temperature: 0,
      maxTokens: null, maxIterations: 5, stopCondition: 'no-tool-calls',
    },
  };
}
const ctx = () => ({ signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: 'k' });

describe('agentNode', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    // Mock runToolBatch to avoid Worker dependency in tests
    vi.spyOn(toolBatchModule, 'runToolBatch').mockResolvedValue({ results: [], toolMessages: [] });
  });

  it('returns text immediately when LLM emits no tool calls', async () => {
    vi.spyOn(llmOnceModule, 'llmOnce').mockResolvedValue({
      text: 'final', toolCalls: [],
      request: {}, response: { text: 'final' },
      usage: { input: 1, output: 2 }, timing: { totalMs: 1, firstTokenMs: 0 },
    });
    const out = await agentNode.run(makeAgent(), { text: 'hi' }, ctx());
    expect(out.text).toBe('final');
    expect(out.iterationCount).toBe(1);
  });

  it('loops while toolCalls are emitted, stops when they stop', async () => {
    const responses = [
      { text: '', toolCalls: [{ id: 't1', type: 'function' as const, function: { name: 'noop', arguments: '{}' } }],
        request: {}, response: { text: '' }, usage: { input: 1, output: 1 }, timing: { totalMs: 1, firstTokenMs: 0 } },
      { text: 'done', toolCalls: [],
        request: {}, response: { text: 'done' }, usage: { input: 1, output: 1 }, timing: { totalMs: 1, firstTokenMs: 0 } },
    ];
    vi.spyOn(llmOnceModule, 'llmOnce').mockImplementation(async () => responses.shift()!);
    const tools = [{ name: 'noop', description: '', inputSchema: { type: 'object' }, code: 'return null;', timeoutMs: 1000 }];
    const out = await agentNode.run(makeAgent(), { text: 'go', tools }, ctx());
    expect(out.iterationCount).toBe(2);
    expect(out.text).toBe('done');
  });

  it('errors when maxIterations is exceeded', async () => {
    vi.spyOn(llmOnceModule, 'llmOnce').mockResolvedValue({
      text: '', toolCalls: [{ id: 't', type: 'function' as const, function: { name: 'x', arguments: '{}' } }],
      request: {}, response: { text: '' }, usage: { input: 0, output: 0 }, timing: { totalMs: 0, firstTokenMs: 0 },
    });
    const node = makeAgent();
    (node.config as Record<string, unknown>).maxIterations = 2;
    const tools = [{ name: 'x', description: '', inputSchema: { type: 'object' }, code: 'return 1;', timeoutMs: 1000 }];
    await expect(agentNode.run(node, { text: 'go', tools }, ctx())).rejects.toThrow(/maxIterations/);
  });
});
