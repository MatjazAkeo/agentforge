import { registerNodeDefinition, type NodeDefinition } from './registry';
import { extractText, type Context } from '@/domain/context';

export const chatOutputNode: NodeDefinition = {
  type: 'chat-output',
  inputPorts: ['context'],
  outputPorts: [],
  async run(_node, inputs, ctx) {
    ctx.details.value = extractText(inputs.context as Context[] | undefined);
    return {};
  },
};

registerNodeDefinition(chatOutputNode);
