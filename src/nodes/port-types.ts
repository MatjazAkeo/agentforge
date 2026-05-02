import type { Node } from '@/domain/graph';
import type { InputConfig } from '@/domain/node-types';

/**
 * Port data types. No `any` — every port declares exactly what it produces or accepts.
 * Connection rule: source.type === target.type.
 */
export type DataType = 'string' | 'number' | 'json' | 'messages' | 'tools';

const TYPE_COLORS: Record<DataType, string> = {
  string: '#ffaa55',
  number: '#5cd97a',
  json: '#4ad7e2',
  messages: '#b388ff',
  tools: '#ffd54a',
};

export function colorForType(type: DataType | null): string {
  return type ? TYPE_COLORS[type] : '#888';
}

function inputValueType(cfg: InputConfig): DataType {
  switch (cfg.valueType) {
    case 'text': return 'string';
    case 'number': return 'number';
    case 'json': return 'json';
  }
}

/** Returns the data type produced by a source-side handle on this node, or null if no such source port. */
export function getSourcePortType(node: Node, handleId: string): DataType | null {
  switch (node.type) {
    case 'input':
      if (handleId === 'value') return inputValueType(node.config as InputConfig);
      return null;
    case 'llm-call':
      if (handleId === 'text') return 'string';
      if (handleId === 'messages') return 'messages';
      return null;
    default:
      return null;
  }
}

/** Returns the data type accepted by a target-side handle on this node, or null if no such target port. */
export function getTargetPortType(node: Node, handleId: string): DataType | null {
  switch (node.type) {
    case 'output':
      // v1: Output accepts strings only. Plan 2's Transform node converts other types.
      if (handleId === 'value') return 'string';
      return null;
    case 'llm-call':
      if (handleId === 'userMessage') return 'string';
      if (handleId === 'messages') return 'messages';
      if (handleId === 'tools') return 'tools';
      return null;
    default:
      return null;
  }
}
