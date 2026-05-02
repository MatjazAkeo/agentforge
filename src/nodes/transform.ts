import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { TransformConfig } from '@/domain/node-types';
import { renderTemplate } from './_internals/template-vars';

const PATH_SEGMENT = /([^.[\]]+)|\[(-?\d+)\]/g;

function readJsonPath(value: unknown, path: string): unknown {
  if (!path) return value;
  let cursor: unknown = value;
  PATH_SEGMENT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_SEGMENT.exec(path)) !== null) {
    if (cursor === null || cursor === undefined) return undefined;
    if (m[1] !== undefined) {
      // object key
      cursor = (cursor as Record<string, unknown>)[m[1]];
    } else {
      // array index (m[2])
      const idx = parseInt(m[2], 10);
      if (!Array.isArray(cursor)) return undefined;
      const arr = cursor as unknown[];
      const real = idx < 0 ? arr.length + idx : idx;
      cursor = arr[real];
    }
  }
  return cursor;
}

export const transformNode: NodeDefinition = {
  type: 'transform',
  inputPorts: ['value'],
  outputPorts: ['result'],
  async run(node, inputs) {
    const cfg = node.config as TransformConfig;
    const value = inputs.value;

    switch (cfg.mode) {
      case 'json-parse': {
        if (typeof value !== 'string') {
          throw new Error('Transform json-parse: input is not a string');
        }
        try { return { result: JSON.parse(value) }; }
        catch (e) { throw new Error(`Transform json-parse: invalid JSON — ${(e as Error).message}`); }
      }
      case 'json-stringify': {
        return { result: JSON.stringify(value, null, 2) };
      }
      case 'json-path': {
        const path = cfg.path ?? '';
        return { result: readJsonPath(value, path) };
      }
      case 'regex-extract': {
        if (!cfg.pattern) throw new Error('Transform regex-extract: no pattern configured');
        // Coerce to string so booleans/numbers/objects can flow in. This is what
        // makes the self-critique pattern work: a boolean from `json-path "good"`
        // arrives as `false`, which String() turns into "false" — the regex can
        // then match it. null/undefined become "" so they never match anything
        // (returning null, the falsy halt-signal in continue wires).
        const str =
          typeof value === 'string'
            ? value
            : value === null || value === undefined
              ? ''
              : String(value);
        const re = new RegExp(cfg.pattern);
        const match = str.match(re);
        if (!match) return { result: null };
        const group = cfg.group ?? 0;
        return { result: match[group] ?? null };
      }
      case 'template': {
        const tpl = cfg.template ?? '';
        return { result: renderTemplate(tpl, { value }) };
      }
      case 'custom': {
        const code = cfg.code ?? '';
        if (!code.trim()) throw new Error('Transform custom: no code configured');
        // User-authored JS function body. Same trust model as Tool nodes —
        // graphs containing custom code prompt the user before opening.
        // Synchronous only; this is pure data shaping, no I/O.
        let fn: (value: unknown) => unknown;
        try {
          fn = new Function('value', code) as (value: unknown) => unknown;
        } catch (e) {
          throw new Error(`Transform custom: parse error — ${(e as Error).message}`);
        }
        try {
          return { result: fn(value) };
        } catch (e) {
          throw new Error(`Transform custom: runtime error — ${(e as Error).message}`);
        }
      }
      default: {
        throw new Error(`Transform: unknown mode "${(cfg as { mode: string }).mode}"`);
      }
    }
  },
};

registerNodeDefinition(transformNode);
