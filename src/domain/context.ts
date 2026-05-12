// Context — the core LLM conversation data type. Matches the shape every
// provider's chat-completions API accepts (OpenAI / Anthropic / Gemini all
// emit/receive arrays of role-tagged messages with optional multimodal
// content). Wire payloads on the `context` wire are `Context[]`.

import type { ToolCall } from '@/openrouter/types';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface Context {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
}

/** Wrap a plain string as a single user-message context. */
export function wrapAsContext(text: string): Context[] {
  return [{ role: 'user', content: text }];
}

/** Wrap image data URLs as a single user message with image_url parts. */
export function wrapImagesAsContext(imageDataUrls: string[]): Context[] {
  return [{
    role: 'user',
    content: imageDataUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url },
    })),
  }];
}

/**
 * Wrap a mix of text + image data URLs as a single user message. If only
 * text is given (no images) the content collapses to a plain string for
 * provider portability. If only one text part survives, same collapse.
 */
export function wrapAsContextMixed(text: string, imageDataUrls: string[]): Context[] {
  const parts: ContentPart[] = [];
  if (text) parts.push({ type: 'text', text });
  for (const url of imageDataUrls) parts.push({ type: 'image_url', image_url: { url } });
  if (parts.length === 0) return [{ role: 'user', content: '' }];
  if (parts.length === 1 && parts[0].type === 'text') {
    return [{ role: 'user', content: parts[0].text }];
  }
  return [{ role: 'user', content: parts }];
}

/**
 * Extract a string from a context for downstream string consumers (Output,
 * Chat Output, Prompt Template variable substitution). Takes the last
 * message; if its content is multimodal, joins the text parts and skips
 * image_url parts. Empty/missing → empty string.
 */
export function extractText(ctx: Context[] | undefined | null): string {
  if (!ctx || ctx.length === 0) return '';
  const last = ctx[ctx.length - 1];
  if (typeof last.content === 'string') return last.content;
  return last.content
    .filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/** Linear search backward; -1 if no match. Used by mergeContextsMergeLastUser. */
export function findLastIndex<T>(arr: T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}
