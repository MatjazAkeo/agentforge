import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ImageRef } from '@/domain/images';

export const chatInputNode: NodeDefinition = {
  type: 'chat-input',
  inputPorts: [],
  outputPorts: ['text', 'messages', 'images'],
  async run(_node, _inputs, ctx) {
    if (!ctx.chatSession) {
      throw new Error(
        'Chat Input has no chat session — run the graph from the chat sidebar, not the toolbar.',
      );
    }
    const session = ctx.chatSession;
    const images: ImageRef[] = (session.userAttachments ?? [])
      .filter((a) => a.kind === 'image')
      .map((a) => {
        const img = a as Extract<typeof a, { kind: 'image' }>;
        return { kind: 'inline' as const, dataUrl: img.dataUrl, mime: img.mime };
      });
    return {
      text: session.userMessage,
      messages: session.history,
      images,
    };
  },
};

registerNodeDefinition(chatInputNode);
