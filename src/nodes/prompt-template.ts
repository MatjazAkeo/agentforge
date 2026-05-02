import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { PromptTemplateConfig } from '@/domain/node-types';
import { renderTemplate } from './_internals/template-vars';

export const promptTemplateNode: NodeDefinition = {
  type: 'prompt-template',
  // The static port lists describe the OUTPUT only; dynamic inputs are resolved
  // by port-types.ts at connection time using the live template config.
  inputPorts: [],
  outputPorts: ['text'],
  async run(node, inputs) {
    const cfg = node.config as PromptTemplateConfig;
    return { text: renderTemplate(cfg.template ?? '', inputs) };
  },
};

registerNodeDefinition(promptTemplateNode);
