import { describe, it, expect } from 'vitest';
import { mergeContextsMergeLastUser, type Context } from './context';

describe('mergeContextsMergeLastUser', () => {
  it('passes a single input through unchanged', () => {
    const input: Context[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    expect(mergeContextsMergeLastUser([input])).toEqual(input);
  });

  it('merges two text-only last-user messages into one combined text content', () => {
    const a: Context[] = [{ role: 'user', content: 'first' }];
    const b: Context[] = [{ role: 'user', content: 'second' }];
    const result = mergeContextsMergeLastUser([a, b]);
    expect(result).toEqual([
      { role: 'user', content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ]},
    ]);
  });

  it('merges text + image last-user messages into multimodal user content', () => {
    const a: Context[] = [{ role: 'user', content: "What's this?" }];
    const b: Context[] = [{
      role: 'user',
      content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,x' } }],
    }];
    const result = mergeContextsMergeLastUser([a, b]);
    expect(result[0].content).toEqual([
      { type: 'text', text: "What's this?" },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,x' } },
    ]);
  });

  it('preserves chat history and merges only the last user message', () => {
    const chat: Context[] = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ];
    const ref: Context[] = [{ role: 'user', content: 'reference doc' }];
    const result = mergeContextsMergeLastUser([chat, ref]);
    expect(result).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: [
        { type: 'text', text: 'q2' },
        { type: 'text', text: 'reference doc' },
      ]},
    ]);
  });

  it('keeps a single system message; drops conflicting systems with telemetry', () => {
    const details: Record<string, unknown> = {};
    const a: Context[] = [
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ];
    const b: Context[] = [
      { role: 'system', content: 'be verbose' },
      { role: 'user', content: 'hello' },
    ];
    const result = mergeContextsMergeLastUser([a, b], details);
    expect(result[0]).toEqual({ role: 'system', content: 'be brief' });
    expect(details.systemConflicts).toBe(1);
  });

  it('emits no user message when no input contributes a last user', () => {
    const a: Context[] = [{ role: 'system', content: 'sys' }];
    const b: Context[] = [{ role: 'assistant', content: 'stale reply' }];
    const result = mergeContextsMergeLastUser([a, b]);
    expect(result).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'assistant', content: 'stale reply' },
    ]);
  });

  it('returns empty array for empty inputs', () => {
    expect(mergeContextsMergeLastUser([])).toEqual([]);
    expect(mergeContextsMergeLastUser([[]])).toEqual([]);
  });

  it('keeps trailing tool messages in body (no last-user merge effect)', () => {
    const ctx: Context[] = [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: '', tool_calls: [{ id: 't1', type: 'function', function: { name: 'f', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 't1', content: 'result' },
    ];
    const result = mergeContextsMergeLastUser([ctx]);
    expect(result).toEqual(ctx);
  });
});
