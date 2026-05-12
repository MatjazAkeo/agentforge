import { describe, it, expect } from 'vitest';
import { contextGroupNode } from '@/nodes/context-group';
import type { Node } from '@/domain/graph';
import type { Context } from '@/domain/context';

const ctxBase = () => ({
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
  graphFilePath: '/tmp/x.graph.json' as string | null,
});

const node: Node = {
  id: 'cg', type: 'context-group', position: { x: 0, y: 0 },
  config: { label: 'merged' },
};

describe('context-group node', () => {
  it('passes through a single-input context', async () => {
    const single: Context[] = [{ role: 'user', content: 'hi' }];
    const result = await contextGroupNode.run(node, { contexts: single }, ctxBase());
    expect(result.context).toEqual(single);
  });

  it('merges two contexts via merge-last-user', async () => {
    const a: Context[] = [{ role: 'user', content: 'first' }];
    const b: Context[] = [{ role: 'user', content: 'second' }];
    const result = await contextGroupNode.run(node, { contexts: [a, b] }, ctxBase());
    expect(result.context).toEqual([
      { role: 'user', content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ]},
    ]);
  });

  it('returns empty for no inputs', async () => {
    const result = await contextGroupNode.run(node, { contexts: undefined }, ctxBase());
    expect(result.context).toEqual([]);
  });

  it('counts input contexts in details.inputCount', async () => {
    const ctx = ctxBase();
    const a: Context[] = [{ role: 'user', content: 'a' }];
    const b: Context[] = [{ role: 'user', content: 'b' }];
    await contextGroupNode.run(node, { contexts: [a, b] }, ctx);
    expect(ctx.details.inputCount).toBe(2);
  });
});
