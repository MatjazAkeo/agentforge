import { describe, it, expect } from 'vitest';
import { chatInputNode } from '@/nodes/chat-input';
import { chatOutputNode } from '@/nodes/chat-output';
import type { Node } from '@/domain/graph';

function makeNode(type: 'chat-input' | 'chat-output', config: Record<string, unknown> = {}): Node {
  return { id: 'n', type, position: { x: 0, y: 0 }, config };
}

const baseCtx = (chatSession?: { userMessage: string; history: { role: string; content: string }[] }) => ({
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
  chatSession: chatSession as never,
});

describe('chatInputNode', () => {
  it('emits userMessage and messages from ctx.chatSession', async () => {
    const session = {
      userMessage: 'hello',
      history: [
        { role: 'user' as const, content: 'previous' },
        { role: 'assistant' as const, content: 'reply' },
        { role: 'user' as const, content: 'hello' },
      ],
    };
    const out = await chatInputNode.run(makeNode('chat-input'), {}, baseCtx(session));
    expect(out.userMessage).toBe('hello');
    expect(out.messages).toEqual(session.history);
  });

  it('throws when invoked without a chatSession (graph run from canvas, not chat)', async () => {
    await expect(
      chatInputNode.run(makeNode('chat-input'), {}, baseCtx())
    ).rejects.toThrow(/chat session/i);
  });
});

describe('chatOutputNode', () => {
  it('records the input text on details.value', async () => {
    const ctx = baseCtx();
    await chatOutputNode.run(makeNode('chat-output', { format: 'markdown' }), { text: 'hi there' }, ctx);
    expect(ctx.details.value).toBe('hi there');
  });

  it('coerces non-string input via String()', async () => {
    const ctx = baseCtx();
    await chatOutputNode.run(makeNode('chat-output', { format: 'text' }), { text: 42 as unknown as string }, ctx);
    expect(ctx.details.value).toBe('42');
  });
});
