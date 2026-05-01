import type { ChatCompletionRequest, StreamChunk } from './types';

const BASE = 'https://openrouter.ai/api/v1';

export interface StreamArgs {
  apiKey: string;
  request: ChatCompletionRequest;
  signal: AbortSignal;
  onContentDelta?: (delta: string) => void;
  onUsage?: (usage: { input: number; output: number; cached?: number }) => void;
  onRawChunk?: (chunk: StreamChunk) => void;
}

/**
 * Streams a chat completion. Returns the full assembled assistant text on completion.
 * Throws on non-2xx response or stream error.
 */
export async function streamChatCompletion(args: StreamArgs): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({ ...args.request, stream: true }),
    signal: args.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${body || res.statusText}`);
  }
  if (!res.body) {
    throw new Error('OpenRouter response has no body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let assembled = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
      if (!dataLine) continue;
      const payload = dataLine.slice(6);
      if (payload === '[DONE]') return assembled;
      let chunk: StreamChunk;
      try { chunk = JSON.parse(payload); } catch { continue; }
      args.onRawChunk?.(chunk);
      const choice = chunk.choices?.[0];
      const content = choice?.delta?.content;
      if (typeof content === 'string') {
        assembled += content;
        args.onContentDelta?.(content);
      }
      if (chunk.usage) {
        args.onUsage?.({
          input: chunk.usage.prompt_tokens,
          output: chunk.usage.completion_tokens,
          cached: chunk.usage.prompt_tokens_details?.cached_tokens,
        });
      }
    }
  }
  return assembled;
}

/** Non-streaming convenience for endpoints like /key. */
export async function pingApiKey(apiKey: string): Promise<boolean> {
  const r = await fetch(`${BASE}/key`, { headers: { Authorization: `Bearer ${apiKey}` } });
  return r.ok;
}
