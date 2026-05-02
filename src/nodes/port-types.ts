import type { Node } from '@/domain/graph';

/**
 * Wire types — only what's structurally distinct:
 *   - `string`     — text-shaped data (covers former text / number / json / markdown variants)
 *   - `messages`   — ChatMessage[] (conversation history)
 *   - `tools`      — Tool definition list
 *   - `tool-calls` — Tool invocation list emitted by an LLM (distinct from `tools`)
 *   - `json`       — Arbitrary JSON-shaped data (Tool Runner's `results` output)
 */
export type DataType = 'string' | 'number' | 'messages' | 'tools' | 'tool-calls' | 'json';

const TYPE_COLORS: Record<DataType, string> = {
  string: '#ffaa55',
  number: '#9aa0a8',
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
      if (handleId === 'text') return 'string';
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
    case 'transform':
      if (handleId === 'result') return 'json';
      return null;
    case 'prompt-template':
      if (handleId === 'text') return 'string';
      return null;
    case 'loop-controller': {
      const cfg = node.config as { valueChannels?: Array<{ name: string; type?: DataType }> };
      if (handleId === 'iteration') return 'number';
      if (handleId.startsWith('output-')) {
        const name = handleId.slice('output-'.length);
        const ch = cfg.valueChannels?.find((c) => c.name === name);
        if (ch) return ch.type ?? 'json';
      }
      return null;
    }
    case 'agent':
      if (handleId === 'text') return 'string';
      if (handleId === 'messages') return 'messages';
      if (handleId === 'iterationCount') return 'number';
      return null;
    case 'chat-input':
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
      if (handleId === 'value') return 'string';
      return null;
    case 'llm-call':
      if (handleId === 'text') return 'string';
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
    case 'transform':
      if (handleId === 'value') return 'json';
      return null;
    case 'prompt-template': {
      const cfg = node.config as { template?: string };
      // Dynamic: any handle that matches a {{var}} placeholder in the template.
      const tpl = cfg.template ?? '';
      const re = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(tpl)) !== null) {
        if (m[1] === handleId) return 'json';
      }
      return null;
    }
    case 'loop-controller': {
      const cfg = node.config as { valueChannels?: Array<{ name: string; type?: DataType }> };
      if (handleId === 'continue') return 'json';
      if (handleId.startsWith('default-')) {
        const name = handleId.slice('default-'.length);
        const ch = cfg.valueChannels?.find((c) => c.name === name);
        if (ch) return ch.type ?? 'json';
      }
      if (handleId.startsWith('input-')) {
        const name = handleId.slice('input-'.length);
        const ch = cfg.valueChannels?.find((c) => c.name === name);
        if (ch) return ch.type ?? 'json';
      }
      return null;
    }
    case 'agent':
      if (handleId === 'text') return 'string';
      if (handleId === 'messages') return 'messages';
      if (handleId === 'tools') return 'tools';
      return null;
    case 'chat-output':
      if (handleId === 'text') return 'string';
      return null;
    default:
      return null;
  }
}
