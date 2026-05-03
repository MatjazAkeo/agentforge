import { registerNodeDefinition, type NodeDefinition } from './registry';

export const outputNode: NodeDefinition = {
  type: 'output',
  inputPorts: ['text'],
  outputPorts: [],
  async run(_node, inputs, ctx) {
    // Keep `details.value` as the inspector storage key (UI reads from it).
    // The port itself is named `text` for consistency with other string-typed
    // connectors; runtime accepts any value via the universal-json rule.
    ctx.details.value = inputs.text;
    return {};
  },
};

registerNodeDefinition(outputNode);
