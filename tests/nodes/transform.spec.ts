import { describe, it, expect } from 'vitest';
import { transformNode } from '@/nodes/transform';
import type { Node } from '@/domain/graph';

function makeNode(config: Record<string, unknown>): Node {
  return { id: 't', type: 'transform', position: { x: 0, y: 0 }, config };
}

const ctx = () => ({ signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '', graphFilePath: null });

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

  it('regex-extract: coerces non-string input via String() — boolean false matches "false"', async () => {
    // Self-critique pattern: json-path "good" emits a boolean; the next Transform
    // uses regex-extract "false" to negate it (matches → truthy continue, no
    // match → falsy halt).
    const matchFalse = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: 'false' }),
      { value: false },
      ctx(),
    );
    expect(matchFalse.result).toBe('false');

    const matchTrue = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: 'false' }),
      { value: true },
      ctx(),
    );
    expect(matchTrue.result).toBeNull();
  });

  it('regex-extract: null/undefined input never matches', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: '.+' }),
      { value: null },
      ctx(),
    );
    expect(out.result).toBeNull();
  });

  it('custom: runs a JS function body and returns its return value', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'custom', code: 'return value * 2;' }),
      { value: 21 },
      ctx(),
    );
    expect(out.result).toBe(42);
  });

  it('custom: receives complex inputs as `value`', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'custom', code: 'return value.items.map(x => x.name).join(",");' }),
      { value: { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] } },
      ctx(),
    );
    expect(out.result).toBe('a,b,c');
  });

  it('custom: surfaces parse errors with a clear prefix', async () => {
    await expect(
      transformNode.run(
        makeNode({ mode: 'custom', code: 'this is not valid JS @#$%' }),
        { value: null },
        ctx(),
      )
    ).rejects.toThrow(/Transform custom: parse error/);
  });

  it('custom: surfaces runtime errors with a clear prefix', async () => {
    await expect(
      transformNode.run(
        makeNode({ mode: 'custom', code: 'return value.nope.deep;' }),
        { value: null },
        ctx(),
      )
    ).rejects.toThrow(/Transform custom: runtime error/);
  });

  it('custom: throws when no code is configured', async () => {
    await expect(
      transformNode.run(
        makeNode({ mode: 'custom' }),
        { value: 1 },
        ctx(),
      )
    ).rejects.toThrow(/no code/);
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
