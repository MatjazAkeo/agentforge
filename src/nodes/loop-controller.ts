import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LoopControllerConfig } from '@/domain/node-types';

export const loopControllerNode: NodeDefinition = {
  type: 'loop-controller',
  // The port lists are *static names*; channel-suffixed ports are validated by
  // port-types.ts at connection time and resolved dynamically by the runner.
  inputPorts: ['continue'],
  outputPorts: ['iteration'],
  async run(node, inputs) {
    const cfg = node.config as LoopControllerConfig;
    if (!cfg.maxIterations || cfg.maxIterations < 1) {
      throw new Error('Loop Controller: maxIterations must be a positive integer');
    }
    const channels = cfg.valueChannels ?? [];
    const iteration = (inputs.iteration as number | undefined) ?? 1;
    const outputs: Record<string, unknown> = { iteration };
    for (const ch of channels) {
      const cycled = inputs[`input-${ch.name}`];
      const initial = inputs[`default-${ch.name}`];
      // Iteration 1: emit defaults. Subsequent: emit cycled value if provided, else fall back to default.
      outputs[`output-${ch.name}`] = iteration === 1
        ? initial
        : (cycled !== undefined ? cycled : initial);
    }
    return outputs;
  },
};

registerNodeDefinition(loopControllerNode);
