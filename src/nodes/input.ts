import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { InputConfig } from '@/domain/node-types';
import { wrapAsContext } from '@/domain/context';

export const inputNode: NodeDefinition = {
  type: 'input',
  inputPorts: [],
  outputPorts: ['context'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as InputConfig;
    ctx.details.value = cfg.defaultValue;
    return { context: wrapAsContext(cfg.defaultValue) };
  },
};

registerNodeDefinition(inputNode);
