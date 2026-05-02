import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw';
import { llmCallNode } from '@/nodes/llm-call';
import { setActivePinia, createPinia } from 'pinia';
import type { Node } from '@/domain/graph';

describe('LLM Call with tools', () => {
  it('forwards tool definitions in the request and parses tool_calls from the response', async () => {
    setActivePinia(createPinia());
    let capturedBody: any = null;
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
        capturedBody = await request.json();
        const sse =
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"add","arguments":"{\\"a\\":2,\\"b\\":3}"}}]}}]}\n\n` +
          `data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}\n\n` +
          `data: [DONE]\n\n`;
        return new HttpResponse(sse, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );

    const node: Node = {
      id: 'l', type: 'llm-call', position: { x: 0, y: 0 },
      config: { model: 'm', systemPrompt: '', temperature: 0.5, maxTokens: null, responseFormat: null },
    };
    const tools = [{ toolId: 't1', name: 'add', description: 'add two numbers', inputSchema: { type: 'object' }, code: '', timeoutMs: 1000 }];
    const ctx = { signal: new AbortController().signal, details: {} as any, apiKey: 'k' };
    const out = await llmCallNode.run(node, { userMessage: 'add 2 and 3', tools }, ctx);

    expect(capturedBody.tools).toBeDefined();
    expect(Array.isArray(capturedBody.tools)).toBe(true);
    expect(capturedBody.tools[0].function.name).toBe('add');
    const toolCalls = out.toolCalls as any[];
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].function.name).toBe('add');
    expect(toolCalls[0].function.arguments).toBe('{"a":2,"b":3}');
  });
});
