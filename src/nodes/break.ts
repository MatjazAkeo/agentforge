import { registerNodeDefinition, type NodeDefinition } from './registry';

export const breakNode: NodeDefinition = {
  type: 'break',
  inputPorts: ['value'],
  outputPorts: ['value'],
  async run(_node, inputs) {
    return { value: inputs.value };
  },
};

registerNodeDefinition(breakNode);
