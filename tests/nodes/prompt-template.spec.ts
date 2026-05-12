import { describe, it, expect } from 'vitest';
import { promptTemplateNode } from '@/nodes/prompt-template';
import type { Node } from '@/domain/graph';

function makeNode(template: string): Node {
  return { id: 'pt', type: 'prompt-template', position: { x: 0, y: 0 }, config: { template } };
}
const ctx = () => ({ signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '', graphFilePath: null });

describe('promptTemplateNode', () => {
  it('renders a template with no placeholders wrapped as context', async () => {
    const out = await promptTemplateNode.run(makeNode('plain'), {}, ctx());
    expect(out.context).toEqual([{ role: 'user', content: 'plain' }]);
  });

  it('substitutes a single placeholder from string input', async () => {
    const out = await promptTemplateNode.run(makeNode('Hi {{name}}'), { name: 'Ada' }, ctx());
    expect(out.context).toEqual([{ role: 'user', content: 'Hi Ada' }]);
  });

  it('substitutes a single placeholder from context-wrapped input', async () => {
    const out = await promptTemplateNode.run(
      makeNode('Hi {{name}}'),
      { name: [{ role: 'user', content: 'Ada' }] },
      ctx(),
    );
    expect(out.context).toEqual([{ role: 'user', content: 'Hi Ada' }]);
  });

  it('substitutes multiple placeholders from mixed string + context inputs', async () => {
    const out = await promptTemplateNode.run(
      makeNode('{{greeting}}, {{name}}'),
      { greeting: 'Hello', name: [{ role: 'user', content: 'Ada' }] },
      ctx(),
    );
    expect(out.context).toEqual([{ role: 'user', content: 'Hello, Ada' }]);
  });

  it('coerces non-string non-context inputs to JSON', async () => {
    const out = await promptTemplateNode.run(
      makeNode('count={{n}} list={{xs}}'),
      { n: 3, xs: [1, 2, 3] },
      ctx(),
    );
    expect(out.context).toEqual([{ role: 'user', content: 'count=3 list=[1,2,3]' }]);
  });
});
