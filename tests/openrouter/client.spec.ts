import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw';
import { streamChatCompletion } from '@/openrouter/client';

describe('OpenRouter client - streaming', () => {
  it('yields token deltas and final usage', async () => {
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', () => {
        const sse =
          `data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n` +
          `data: {"choices":[{"delta":{"content":" world"}}]}\n\n` +
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n` +
          `data: [DONE]\n\n`;
        return new HttpResponse(sse, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );

    const events: string[] = [];
    let usage: { input: number; output: number } | null = null;
    const text = await streamChatCompletion({
      apiKey: 'k',
      request: { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
      signal: new AbortController().signal,
      onContentDelta: (chunk) => events.push(chunk),
      onUsage: (u) => { usage = u; },
    });

    expect(events).toEqual(['Hello', ' world']);
    expect(text).toBe('Hello world');
    expect(usage).toEqual({ input: 10, output: 5 });
  });

  it('throws on non-2xx', async () => {
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', () =>
        HttpResponse.json({ error: 'rate limited' }, { status: 429 }),
      ),
    );

    await expect(
      streamChatCompletion({
        apiKey: 'k',
        request: { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/429/);
  });
});
