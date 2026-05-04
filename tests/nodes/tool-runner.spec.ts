// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { toolRunnerNode } from '@/nodes/tool-runner';
import type { Node } from '@/domain/graph';
import type { ToolDefinitionPayload } from '@/nodes/tool';
import type { ChatMessage } from '@/openrouter/types';

// Reuse the worker polyfill set up in Task 3
beforeAll(async () => {
  await import('../setup/worker-polyfill');
});

describe('tool-runner node', () => {
  it('executes a matching tool and appends a tool message to the conversation', async () => {
    setActivePinia(createPinia());
    const tools: ToolDefinitionPayload[] = [{
      toolId: 't1', name: 'add', description: 'sum two numbers',
      inputSchema: { type: 'object', properties: { a: {type: 'number'}, b: {type: 'number'} } },
      code: 'return inputs.a + inputs.b;',
      timeoutMs: 1000,
    }];
    const node: Node = { id: 'r', type: 'tool-runner', position: { x: 0, y: 0 }, config: {} };
    const messages: ChatMessage[] = [
      { role: 'user', content: 'add 2 and 3' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'add', arguments: '{"a":2,"b":3}' } }] },
    ];
    const inputs = {
      toolCalls: [{ id: 'c1', type: 'function', function: { name: 'add', arguments: '{"a":2,"b":3}' } }],
      tools,
      messages,
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '', graphFilePath: null };
    const out = await toolRunnerNode.run(node, inputs, ctx);

    const outMessages = out.messages as ChatMessage[];
    expect(outMessages.length).toBe(3);
    expect(outMessages[2].role).toBe('tool');
    expect(outMessages[2].content).toBe('5');
    expect(outMessages[2].tool_call_id).toBe('c1');
  });

  it('records an error on the result row when tool not found', async () => {
    setActivePinia(createPinia());
    const node: Node = { id: 'r', type: 'tool-runner', position: { x: 0, y: 0 }, config: {} };
    const inputs = {
      toolCalls: [{ id: 'c1', type: 'function', function: { name: 'unknown', arguments: '{}' } }],
      tools: [],
      messages: [],
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '', graphFilePath: null };
    const out = await toolRunnerNode.run(node, inputs, ctx);
    const results = out.results as Array<{ error?: string }>;
    expect(results[0].error).toMatch(/not found/i);
  });
});
