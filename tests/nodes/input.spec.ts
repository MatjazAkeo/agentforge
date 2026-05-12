import { describe, it, expect } from 'vitest';
import { inputNode } from '@/nodes/input';
import type { Node } from '@/domain/graph';

describe('input node', () => {
  it('emits its config defaultValue wrapped as a single user-message context', async () => {
    const node: Node = {
      id: 'a', type: 'input', position: { x: 0, y: 0 },
      config: { name: 'q', defaultValue: 'hello' },
    };
    const ctx = { signal: new AbortController().signal, details: {}, apiKey: '', graphFilePath: null };
    const result = await inputNode.run(node, {}, ctx);
    expect(result).toEqual({ context: [{ role: 'user', content: 'hello' }] });
  });

  it('emits empty-string user message when defaultValue is empty', async () => {
    const node: Node = {
      id: 'a', type: 'input', position: { x: 0, y: 0 },
      config: { name: 'q', defaultValue: '' },
    };
    const ctx = { signal: new AbortController().signal, details: {}, apiKey: '', graphFilePath: null };
    const result = await inputNode.run(node, {}, ctx);
    expect(result).toEqual({ context: [{ role: 'user', content: '' }] });
  });
});
