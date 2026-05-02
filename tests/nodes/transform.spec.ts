import { describe, it, expect } from 'vitest';
import { transformNode } from '@/nodes/transform';
import type { Node } from '@/domain/graph';

function makeNode(config: Record<string, unknown>): Node {
  return { id: 't', type: 'transform', position: { x: 0, y: 0 }, config };
}

const ctx = () => ({ signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '' });

describe('transformNode', () => {
  it('json-parse: parses a JSON string into an object', async () => {
    const out = await transformNode.run(makeNode({ mode: 'json-parse' }), { value: '{"a":1}' }, ctx());
    expect(out.result).toEqual({ a: 1 });
  });

  it('json-parse: throws a clear error on invalid JSON', async () => {
    await expect(
      transformNode.run(makeNode({ mode: 'json-parse' }), { value: 'not json' }, ctx())
    ).rejects.toThrow(/JSON/);
  });

  it('json-stringify: serializes an object to a 2-space indented string', async () => {
    const out = await transformNode.run(makeNode({ mode: 'json-stringify' }), { value: { a: 1 } }, ctx());
    expect(out.result).toBe('{\n  "a": 1\n}');
  });

  it('json-path: reads a deep field by dot-path', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'json-path', path: 'a.b.c' }),
      { value: { a: { b: { c: 'found' } } } },
      ctx(),
    );
    expect(out.result).toBe('found');
  });

  it('json-path: indexes into arrays with [n] (and supports -1 for last)', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'json-path', path: 'msgs[-1].content' }),
      { value: { msgs: [{ content: 'first' }, { content: 'last' }] } },
      ctx(),
    );
    expect(out.result).toBe('last');
  });

  it('json-path: returns undefined for a missing path', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'json-path', path: 'a.missing' }),
      { value: { a: {} } },
      ctx(),
    );
    expect(out.result).toBeUndefined();
  });

  it('regex-extract: returns the whole match when group is omitted', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: '\\d+' }),
      { value: 'order #42 placed' },
      ctx(),
    );
    expect(out.result).toBe('42');
  });

  it('regex-extract: returns the requested capture group', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: 'order #(\\d+)', group: 1 }),
      { value: 'order #42 placed' },
      ctx(),
    );
    expect(out.result).toBe('42');
  });

  it('regex-extract: returns null when there is no match', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: '\\d+' }),
      { value: 'no digits' },
      ctx(),
    );
    expect(out.result).toBeNull();
  });

  it('template: renders {{value}} with the input', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'template', template: 'Hello {{value}}!' }),
      { value: 'world' },
      ctx(),
    );
    expect(out.result).toBe('Hello world!');
  });
});
