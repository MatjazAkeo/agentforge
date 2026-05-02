import type { Node } from '@/domain/graph';
import type { OutputConfig } from '@/domain/node-types';

/**
 * Wire types — only what's structurally distinct:
 *   - `string`   — any text-shaped data (covers former text / number / json / markdown variants;
 *                  display formatting is a receiver concern, not a wire concern)
 *   - `messages` — ChatMessage[] (conversation history)
 *   - `tools`    — Tool definition list (Plan 2)
 *
 * Connection rule: source.type === target.type. No `any`, no implicit coercion.
 */
export type DataType = 'string' | 'messages' | 'tools';

const TYPE_COLORS: Record<DataType, string> = {
  string: '#ffaa55',
  messages: '#b388ff',
  tools: '#ffd54a',
};

export function colorForType(type: DataType | null): string {
  return type ? TYPE_COLORS[type] : '#888';
}

/** Returns the data type produced by a source-side handle on this node, or null if no such source port. */
export function getSourcePortType(node: Node, handleId: string): DataType | null {
  switch (node.type) {
    case 'input':
      // Input.valueType is a UI hint for the form widget; the wire is always string-shaped.
      if (handleId === 'value') return 'string';
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
      if (handleId === 'value') {
        // Format drives the accepted type. 'messages' format displays a chat transcript;
        // every other format renders text-shaped data.
        const cfg = node.config as OutputConfig;
        return cfg.format === 'messages' ? 'messages' : 'string';
      }
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
