import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { InputConfig } from '@/domain/node-types';

export const inputNode: NodeDefinition = {
  type: 'input',
  inputPorts: [],
  outputPorts: ['value'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as InputConfig;
    ctx.details.value = cfg.defaultValue;
    return { value: cfg.defaultValue };
  },
};

registerNodeDefinition(inputNode);
