import { describe, it, expect } from 'vitest';
import { outputNode } from '@/nodes/output';
import type { Node } from '@/domain/graph';

describe('output node', () => {
  it('records its incoming value into details', async () => {
    const node: Node = {
      id: 'b', type: 'output', position: { x: 0, y: 0 },
      config: { format: 'auto' },
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '', graphFilePath: null };
    await outputNode.run(node, { text: 'hello' }, ctx);
    expect(ctx.details.value).toBe('hello');
  });

  it('returns no outputs (terminal node)', async () => {
    const node: Node = {
      id: 'b', type: 'output', position: { x: 0, y: 0 },
      config: { format: 'auto' },
    };
    const ctx = { signal: new AbortController().signal, details: {}, apiKey: '', graphFilePath: null };
    const result = await outputNode.run(node, { text: 'x' }, ctx);
    expect(result).toEqual({});
  });
});
