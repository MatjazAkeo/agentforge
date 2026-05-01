import { describe, it, expect } from 'vitest';
import { inputNode } from '@/nodes/input';
import type { Node } from '@/domain/graph';

describe('input node', () => {
  it('emits its config defaultValue on the value port', async () => {
    const node: Node = {
      id: 'a', type: 'input', position: { x: 0, y: 0 },
      config: { name: 'q', valueType: 'text', defaultValue: 'hello' },
    };
    const ctx = { signal: new AbortController().signal, details: {}, apiKey: '' };
    const result = await inputNode.run(node, {}, ctx);
    expect(result).toEqual({ value: 'hello' });
  });

  it('emits 0 when defaultValue is 0 (number type)', async () => {
    const node: Node = {
      id: 'a', type: 'input', position: { x: 0, y: 0 },
      config: { name: 'n', valueType: 'number', defaultValue: 0 },
    };
    const ctx = { signal: new AbortController().signal, details: {}, apiKey: '' };
    const result = await inputNode.run(node, {}, ctx);
    expect(result).toEqual({ value: 0 });
  });
});
