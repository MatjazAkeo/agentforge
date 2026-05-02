import { registerNodeDefinition, type NodeDefinition } from './registry';

export const chatInputNode: NodeDefinition = {
  type: 'chat-input',
  inputPorts: [],
  outputPorts: ['userMessage', 'messages'],
  async run(_node, _inputs, ctx) {
    if (!ctx.chatSession) {
      throw new Error(
        'Chat Input has no chat session — run the graph from the chat sidebar, not the toolbar.',
      );
    }
    return {
      userMessage: ctx.chatSession.userMessage,
      messages: ctx.chatSession.history,
    };
  },
};

registerNodeDefinition(chatInputNode);
