import { registerNodeDefinition, type NodeDefinition } from './registry';

export const chatOutputNode: NodeDefinition = {
  type: 'chat-output',
  inputPorts: ['text'],
  outputPorts: [],
  async run(_node, inputs, ctx) {
    const text = typeof inputs.text === 'string' ? inputs.text : String(inputs.text ?? '');
    ctx.details.value = text;
    return {};
  },
};

registerNodeDefinition(chatOutputNode);
