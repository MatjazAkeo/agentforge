import { describe, it, expect } from 'vitest';
import { loopControllerNode } from '@/nodes/loop-controller';
import type { Node } from '@/domain/graph';

function makeNode(channels: string[], maxIterations = 25): Node {
  return {
    id: 'lc',
    type: 'loop-controller',
    position: { x: 0, y: 0 },
    config: {
      maxIterations,
      valueChannels: channels.map((name) => ({ name })),
    },
  };
}

const ctx = {
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
};

describe('loopControllerNode', () => {
  it('emits output-<name> from default-<name> on first invocation', async () => {
    const node = makeNode(['draft']);
    const inputs = { 'default-draft': 'hello', 'iteration': 1 };
    const out = await loopControllerNode.run(node, inputs, ctx);
    expect(out['output-draft']).toBe('hello');
    expect(out['iteration']).toBe(1);
  });

  it('emits output-<name> from input-<name> on subsequent invocation', async () => {
    const node = makeNode(['draft']);
    const inputs = { 'default-draft': 'first', 'input-draft': 'second', 'iteration': 2 };
    const out = await loopControllerNode.run(node, inputs, ctx);
    expect(out['output-draft']).toBe('second');
    expect(out['iteration']).toBe(2);
  });

  it('throws if maxIterations is missing or non-positive', async () => {
    const bad: Node = { ...makeNode(['x'], 0) };
    await expect(loopControllerNode.run(bad, { 'default-x': 1, iteration: 1 }, ctx))
      .rejects.toThrow(/maxIterations/);
  });
});
