import { describe, it, expect } from 'vitest';
import { chatInputNode } from '@/nodes/chat-input';
import { chatOutputNode } from '@/nodes/chat-output';
import type { Node } from '@/domain/graph';

function makeNode(type: 'chat-input' | 'chat-output', config: Record<string, unknown> = {}): Node {
  return { id: 'n', type, position: { x: 0, y: 0 }, config };
}

const baseCtx = (chatSession?: { history: { role: string; content: string }[] }) => ({
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
  chatSession: chatSession as never,
  graphFilePath: null,
});

describe('chatInputNode', () => {
  it('emits the full chat history as context', async () => {
    const session = {
      history: [
        { role: 'user' as const, content: 'previous' },
        { role: 'assistant' as const, content: 'reply' },
        { role: 'user' as const, content: 'hello' },
      ],
    };
    const out = await chatInputNode.run(makeNode('chat-input'), {}, baseCtx(session));
    expect(out.context).toEqual(session.history);
  });

  it('throws when invoked without a chatSession (graph run from canvas, not chat)', async () => {
    await expect(
      chatInputNode.run(makeNode('chat-input'), {}, baseCtx())
    ).rejects.toThrow(/chat session/i);
  });
});

describe('chatOutputNode', () => {
  it('extracts the last message text from context onto details.value', async () => {
    const ctx = baseCtx();
    await chatOutputNode.run(
      makeNode('chat-output', { format: 'markdown' }),
      { context: [{ role: 'assistant', content: 'hi there' }] },
      ctx,
    );
    expect(ctx.details.value).toBe('hi there');
  });

  it('records empty string when context is missing', async () => {
    const ctx = baseCtx();
    await chatOutputNode.run(makeNode('chat-output', { format: 'text' }), {}, ctx);
    expect(ctx.details.value).toBe('');
  });
});
