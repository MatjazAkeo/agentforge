import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { runGraph } from '@/engine/runner';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { Graph } from '@/domain/graph';
import { registerNodeDefinition } from '@/nodes/registry';

// Importing the node modules registers them
import '@/nodes/input';
import '@/nodes/output';
import '@/nodes/loop-controller';
import '@/nodes/break';

describe('runGraph (Input → Output)', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('runs a simple Input → Output graph', async () => {
    const graph: Graph = {
      schemaVersion: 1, id: 'g', name: 'g',
      createdAt: '', updatedAt: '',
      nodes: [
        { id: 'a', type: 'input', position: { x: 0, y: 0 }, config: { name: 'q', defaultValue: 'hello' } },
        { id: 'b', type: 'output', position: { x: 0, y: 0 }, config: { format: 'auto' } },
      ],
      edges: [{ id: 'e', source: 'a', sourceHandle: 'value', target: 'b', targetHandle: 'value' }],
      containsCustomCode: false,
    };

    const graphStore = useGraphStore();
    graphStore.load(graph, '/tmp/x.graph.json');

    await runGraph({ graph, apiKey: '' });

    const runStore = useRunStore();
    expect(runStore.current?.status).toBe('completed');
    expect(runStore.current?.nodeResults['b']?.details.value).toBe('hello');
  });
});

describe('runGraph with Loop Controller', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('runs a counting loop end-to-end and exits via continue=false', async () => {
    // Register a tiny increment body node for this test only.
    registerNodeDefinition({
      type: 'transform',
      inputPorts: ['value'],
      outputPorts: ['result', 'continue'],
      async run(_node, inputs) {
        const v = Number(inputs.value) + 1;
        return { result: v, continue: v < 3 };
      },
    });

    const graph: Graph = {
      schemaVersion: 1, id: 'g', name: 'g', createdAt: '', updatedAt: '',
      containsCustomCode: false,
      nodes: [
        { id: 'seed', type: 'input', position: { x: 0, y: 0 }, config: { name: 'n', defaultValue: '0' } },
        { id: 'lc', type: 'loop-controller', position: { x: 0, y: 0 },
          config: { maxIterations: 10, valueChannels: [{ name: 'n' }] } },
        { id: 'inc', type: 'transform', position: { x: 0, y: 0 }, config: {} },
        { id: 'br', type: 'break', position: { x: 0, y: 0 }, config: {} },
        { id: 'out', type: 'output', position: { x: 0, y: 0 }, config: { format: 'auto' } },
      ],
      edges: [
        { id: 'e1', source: 'seed', sourceHandle: 'value', target: 'lc', targetHandle: 'default-n' },
        { id: 'e2', source: 'lc', sourceHandle: 'output-n', target: 'inc', targetHandle: 'value' },
        { id: 'e3', source: 'inc', sourceHandle: 'result', target: 'lc', targetHandle: 'input-n' },
        { id: 'e4', source: 'inc', sourceHandle: 'continue', target: 'lc', targetHandle: 'continue' },
        { id: 'e5', source: 'lc', sourceHandle: 'output-n', target: 'br', targetHandle: 'value' },
        { id: 'e6', source: 'br', sourceHandle: 'value', target: 'out', targetHandle: 'value' },
      ],
    };

    const result = await runGraph({ graph, apiKey: '' });
    expect(result.status).toBe('completed');
    expect(result.nodeResults.inc.iterations?.length).toBe(3);
    expect(result.nodeResults.lc.details.stopReason).toBe('continue-false');
    // Break node is wired to lc's output-n, which on the last iteration
    // holds the channel value entering that iteration (2), not inc's result (3).
    expect(result.nodeResults.br.output).toEqual({ value: 2 });
  });
});
