import { describe, it, expect } from 'vitest';
import {
  wrapAsContext,
  wrapImagesAsContext,
  wrapAsContextMixed,
  extractText,
  findLastIndex,
  type Context,
  type ContentPart,
} from './context';

describe('wrapAsContext', () => {
  it('wraps a string as a single user message', () => {
    expect(wrapAsContext('hello')).toEqual([{ role: 'user', content: 'hello' }]);
  });
  it('preserves the empty string', () => {
    expect(wrapAsContext('')).toEqual([{ role: 'user', content: '' }]);
  });
});

describe('wrapImagesAsContext', () => {
  it('wraps image data URLs as multimodal user content', () => {
    const result = wrapImagesAsContext(['data:image/jpeg;base64,abc', 'data:image/png;base64,def']);
    expect(result).toEqual([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,def' } },
      ],
    }]);
  });
  it('returns a single user message with empty array for no images', () => {
    expect(wrapImagesAsContext([])).toEqual([{ role: 'user', content: [] }]);
  });
});

describe('wrapAsContextMixed', () => {
  it('collapses to string content when only text is provided', () => {
    expect(wrapAsContextMixed('hi', [])).toEqual([{ role: 'user', content: 'hi' }]);
  });
  it('produces ContentPart[] when both text and images are provided', () => {
    expect(wrapAsContextMixed('look', ['data:image/png;base64,x'])).toEqual([{
      role: 'user',
      content: [
        { type: 'text', text: 'look' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,x' } },
      ],
    }]);
  });
  it('produces image-only ContentPart[] when text is empty but images present', () => {
    expect(wrapAsContextMixed('', ['data:image/png;base64,x'])).toEqual([{
      role: 'user',
      content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,x' } }],
    }]);
  });
  it('produces empty-string user message when both inputs are empty', () => {
    expect(wrapAsContextMixed('', [])).toEqual([{ role: 'user', content: '' }]);
  });
});

describe('extractText', () => {
  it('returns the string content of the last message', () => {
    const ctx: Context[] = [
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
    ];
    expect(extractText(ctx)).toBe('two');
  });
  it('joins text parts from multimodal content, skipping images', () => {
    const parts: ContentPart[] = [
      { type: 'text', text: 'hello ' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,x' } },
      { type: 'text', text: 'world' },
    ];
    const ctx: Context[] = [{ role: 'user', content: parts }];
    expect(extractText(ctx)).toBe('hello world');
  });
  it('returns empty string for empty/undefined/null input', () => {
    expect(extractText(undefined)).toBe('');
    expect(extractText(null)).toBe('');
    expect(extractText([])).toBe('');
  });
  it('returns empty string when last message has empty content', () => {
    expect(extractText([{ role: 'user', content: '' }])).toBe('');
  });
});

describe('findLastIndex', () => {
  it('returns the index of the last matching element', () => {
    expect(findLastIndex([1, 2, 3, 2, 1], (v) => v === 2)).toBe(3);
  });
  it('returns -1 when no element matches', () => {
    expect(findLastIndex([1, 2, 3], (v) => v === 99)).toBe(-1);
  });
  it('returns -1 for empty array', () => {
    expect(findLastIndex([], () => true)).toBe(-1);
  });
});
