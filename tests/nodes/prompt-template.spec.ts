import { describe, it, expect } from 'vitest';
import { promptTemplateNode } from '@/nodes/prompt-template';
import type { Node } from '@/domain/graph';

function makeNode(template: string): Node {
  return { id: 'pt', type: 'prompt-template', position: { x: 0, y: 0 }, config: { template } };
}
const ctx = () => ({ signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '' });

describe('promptTemplateNode', () => {
  it('renders a template with no placeholders verbatim', async () => {
    const out = await promptTemplateNode.run(makeNode('plain'), {}, ctx());
    expect(out.rendered).toBe('plain');
  });

  it('substitutes a single placeholder from inputs', async () => {
    const out = await promptTemplateNode.run(makeNode('Hi {{name}}'), { name: 'Ada' }, ctx());
    expect(out.rendered).toBe('Hi Ada');
  });

  it('substitutes multiple placeholders from inputs', async () => {
    const out = await promptTemplateNode.run(
      makeNode('{{greeting}}, {{name}}'),
      { greeting: 'Hello', name: 'Ada' },
      ctx(),
    );
    expect(out.rendered).toBe('Hello, Ada');
  });

  it('coerces non-string inputs to JSON', async () => {
    const out = await promptTemplateNode.run(
      makeNode('count={{n}} list={{xs}}'),
      { n: 3, xs: [1, 2, 3] },
      ctx(),
    );
    expect(out.rendered).toBe('count=3 list=[1,2,3]');
  });
});
