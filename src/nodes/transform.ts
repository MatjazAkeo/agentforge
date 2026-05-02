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
        if (typeof value !== 'string') {
          throw new Error('Transform regex-extract: input is not a string');
        }
        if (!cfg.pattern) throw new Error('Transform regex-extract: no pattern configured');
        const re = new RegExp(cfg.pattern);
        const match = value.match(re);
        if (!match) return { result: null };
        const group = cfg.group ?? 0;
        return { result: match[group] ?? null };
      }
      case 'template': {
        const tpl = cfg.template ?? '';
        return { result: renderTemplate(tpl, { value }) };
      }
      default: {
        throw new Error(`Transform: unknown mode "${(cfg as { mode: string }).mode}"`);
      }
    }
  },
};

registerNodeDefinition(transformNode);
