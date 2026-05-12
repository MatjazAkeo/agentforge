import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw';
import { llmCallNode } from '@/nodes/llm-call';
import type { Node } from '@/domain/graph';
import { setActivePinia, createPinia } from 'pinia';

describe('llm-call node', () => {
  it('calls OpenRouter, streams content, records details', async () => {
    setActivePinia(createPinia());
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', () => {
        const sse =
          `data: {"choices":[{"delta":{"content":"Paris"}}]}\n\n` +
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}\n\n` +
          `data: [DONE]\n\n`;
        return new HttpResponse(sse, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );

    const node: Node = {
      id: 'l', type: 'llm-call', position: { x: 0, y: 0 },
      config: {
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        systemPrompt: 'Be concise.',
        temperature: 0.7, maxTokens: null, responseFormat: null,
      },
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: 'test-key', graphFilePath: null };
    const out = await llmCallNode.run(node, { context: [{ role: 'user', content: 'capital of France?' }] }, ctx);

    // Output context = system prompt (prepended) + incoming user + new assistant reply.
    expect(out.context).toEqual([
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'capital of France?' },
      { role: 'assistant', content: 'Paris' },
    ]);
    expect(out.usage).toEqual({ input: 3, output: 1 });
    expect(ctx.details.request).toBeDefined();
    expect(ctx.details.timing).toBeDefined();
  });
});
