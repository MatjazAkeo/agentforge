import { describe, it, expect } from 'vitest';
import { chatInputNode } from '@/nodes/chat-input';

const ctx = (chatSession: any) => ({
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
  graphFilePath: '/u/m/proj.graph.json',
  chatSession,
});

const node = { id: 'ci', type: 'chat-input' as const, position: { x: 0, y: 0 }, config: {} };

describe('chat-input node — image output', () => {
  it('emits inline ImageRefs when the latest user turn has image attachments', async () => {
    const session = {
      userMessage: 'describe',
      userAttachments: [
        { kind: 'image', filename: 'a.jpg', dataUrl: 'data:image/jpeg;base64,xxx', mime: 'image/jpeg', sizeBytes: 1 },
      ],
      history: [{ role: 'user', content: 'describe' }],
    };
    const result = await chatInputNode.run(node, {}, ctx(session));
    expect(result.images).toEqual([
      { kind: 'inline', dataUrl: 'data:image/jpeg;base64,xxx', mime: 'image/jpeg' },
    ]);
  });

  it('emits empty array when no image attachments', async () => {
    const session = {
      userMessage: 'hi',
      userAttachments: [],
      history: [{ role: 'user', content: 'hi' }],
    };
    const result = await chatInputNode.run(node, {}, ctx(session));
    expect(result.images).toEqual([]);
  });
});
