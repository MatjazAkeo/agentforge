import type { Node } from '@/domain/graph';

/**
 * Wire types — only what's structurally distinct:
 *   - `string`     — text-shaped data (covers former text / number / json / markdown variants)
 *   - `messages`   — ChatMessage[] (conversation history)
 *   - `tools`      — Tool definition list
 *   - `tool-calls` — Tool invocation list emitted by an LLM (distinct from `tools`)
 *   - `json`       — Arbitrary JSON-shaped data (Tool Runner's `results` output)
 */
export type DataType = 'string' | 'messages' | 'tools' | 'tool-calls' | 'json';

const TYPE_COLORS: Record<DataType, string> = {
  string: '#ffaa55',
  messages: '#b388ff',
  tools: '#ffd54a',
  'tool-calls': '#ff5577',
  json: '#4ad7e2',
};

export function colorForType(type: DataType | null): string {
  return type ? TYPE_COLORS[type] : '#888';
}

/** Returns the data type produced by a source-side handle on this node, or null if no such source port. */
export function getSourcePortType(node: Node, handleId: string): DataType | null {
  switch (node.type) {
    case 'input':
      if (handleId === 'value') return 'string';
      return null;
    case 'llm-call':
      if (handleId === 'text') return 'string';
      if (handleId === 'messages') return 'messages';
      if (handleId === 'toolCalls') return 'tool-calls';
      return null;
    case 'tool':
      if (handleId === 'toolDefinition') return 'tools';
      return null;
    case 'tool-group':
      if (handleId === 'toolDefinition') return 'tools';
      return null;
    case 'tool-runner':
      if (handleId === 'messages') return 'messages';
      if (handleId === 'results') return 'json';
      return null;
    default:
      return null;
  }
}

/** Returns the data type accepted by a target-side handle on this node, or null if no such target port. */
export function getTargetPortType(node: Node, handleId: string): DataType | null {
  switch (node.type) {
    case 'output':
      if (handleId === 'value') return 'string';
      return null;
    case 'llm-call':
      if (handleId === 'userMessage') return 'string';
      if (handleId === 'messages') return 'messages';
      if (handleId === 'tools') return 'tools';
      return null;
    case 'tool-group':
      if (handleId === 'tools') return 'tools';
      return null;
    case 'tool-runner':
      if (handleId === 'toolCalls') return 'tool-calls';
      if (handleId === 'tools') return 'tools';
      if (handleId === 'messages') return 'messages';
      return null;
    default:
      return null;
  }
}
