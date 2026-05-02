// Native browser fetch — the WKWebView accepts cross-origin requests to
// OpenRouter (verified by Settings → Test connection). Tauri's plugin-http
// caused 401s due to a header-forwarding subtlety; native fetch is simpler
// and works as long as we hand it a non-empty trimmed key.
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
  // Defensive trim — paste-from-clipboard sometimes carries trailing whitespace/newlines
  // that turn the Authorization header into an invalid value.
  const apiKey = (args.apiKey ?? '').trim();
  if (!apiKey) {
    throw new Error('OpenRouter API key is missing — open Settings → API Key and paste your key.');
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${apiKey}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...args.request, stream: true }),
      signal: args.signal,
    });
  } catch (e) {
    // Tauri plugin-http throws "resource id X is invalid" when an in-flight
    // request is aborted by the user. Surface as a normal abort, not an error.
    if (args.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    throw e;
  }

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
    let value: Uint8Array | undefined;
    let done = false;
    try {
      ({ value, done } = await reader.read());
    } catch (e) {
      if (args.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      throw e;
    }
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
