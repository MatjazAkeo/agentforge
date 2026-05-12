import { describe, it, expect } from 'vitest';
import { outputNode } from '@/nodes/output';
import type { Node } from '@/domain/graph';

describe('output node', () => {
  it('records the last message text from incoming context into details', async () => {
    const node: Node = {
      id: 'b', type: 'output', position: { x: 0, y: 0 },
      config: { format: 'auto' },
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '', graphFilePath: null };
    await outputNode.run(node, { context: [{ role: 'user', content: 'hello' }] }, ctx);
    expect(ctx.details.value).toBe('hello');
  });

  it('extracts the last assistant message when context has a conversation', async () => {
    const node: Node = {
      id: 'b', type: 'output', position: { x: 0, y: 0 },
      config: { format: 'auto' },
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '', graphFilePath: null };
    await outputNode.run(node, { context: [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ] }, ctx);
    expect(ctx.details.value).toBe('a');
  });

  it('returns no outputs (terminal node)', async () => {
    const node: Node = {
      id: 'b', type: 'output', position: { x: 0, y: 0 },
      config: { format: 'auto' },
    };
    const ctx = { signal: new AbortController().signal, details: {}, apiKey: '', graphFilePath: null };
    const result = await outputNode.run(node, { context: [{ role: 'user', content: 'x' }] }, ctx);
    expect(result).toEqual({});
  });
});
