import { registerNodeDefinition, type NodeDefinition } from './registry';

export const outputNode: NodeDefinition = {
  type: 'output',
  inputPorts: ['value'],
  outputPorts: [],
  async run(_node, inputs, ctx) {
    ctx.details.value = inputs.value;
    return {};
  },
};

registerNodeDefinition(outputNode);
