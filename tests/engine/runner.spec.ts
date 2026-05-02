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
      edges: [{ id: 'e', source: 'a', sourceHandle: 'text', target: 'b', targetHandle: 'value' }],
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
        { id: 'out', type: 'output', position: { x: 0, y: 0 }, config: { format: 'auto' } },
      ],
      edges: [
        { id: 'e1', source: 'seed', sourceHandle: 'text', target: 'lc', targetHandle: 'default-n' },
        { id: 'e2', source: 'lc', sourceHandle: 'output-n', target: 'inc', targetHandle: 'value' },
        { id: 'e3', source: 'inc', sourceHandle: 'result', target: 'lc', targetHandle: 'input-n' },
        { id: 'e4', source: 'inc', sourceHandle: 'continue', target: 'lc', targetHandle: 'continue' },
        { id: 'e5', source: 'lc', sourceHandle: 'output-n', target: 'out', targetHandle: 'value' },
      ],
    };

    const result = await runGraph({ graph, apiKey: '' });
    expect(result.status).toBe('completed');
    expect(result.nodeResults.inc.iterations?.length).toBe(3);
    expect(result.nodeResults.lc.details.stopReason).toBe('continue-false');
    // After halt the LC ticks one more time so output-n reflects the body's
    // FINAL write via input-n (the value 3 — iter 3 produced result=3, continue=false).
    // Without the tick the user would see iteration 3's *input* (2), discarding the
    // final body work — the bug that prevented test4's final assistant text from
    // reaching Output.
    expect(result.nodeResults.out.details.value).toBe(3);
  });

  it('completes (soft halt) when continue is always truthy and maxIterations is reached', async () => {
    registerNodeDefinition({
      type: 'transform',
      inputPorts: ['value'],
      outputPorts: ['result', 'continue'],
      async run(_node, inputs) {
        return { result: Number(inputs.value) + 1, continue: true }; // never halts on its own
      },
    });

    const graph: Graph = {
      schemaVersion: 1, id: 'g', name: 'g', createdAt: '', updatedAt: '',
      containsCustomCode: false,
      nodes: [
        { id: 'seed', type: 'input', position: { x: 0, y: 0 }, config: { name: 'n', defaultValue: '0' } },
        { id: 'lc', type: 'loop-controller', position: { x: 0, y: 0 },
          config: { maxIterations: 3, valueChannels: [{ name: 'n' }] } },
        { id: 'inc', type: 'transform', position: { x: 0, y: 0 }, config: {} },
        { id: 'out', type: 'output', position: { x: 0, y: 0 }, config: { format: 'auto' } },
      ],
      edges: [
        { id: 'e1', source: 'seed', sourceHandle: 'text', target: 'lc', targetHandle: 'default-n' },
        { id: 'e2', source: 'lc', sourceHandle: 'output-n', target: 'inc', targetHandle: 'value' },
        { id: 'e3', source: 'inc', sourceHandle: 'result', target: 'lc', targetHandle: 'input-n' },
        { id: 'e4', source: 'inc', sourceHandle: 'continue', target: 'lc', targetHandle: 'continue' },
        { id: 'e5', source: 'lc', sourceHandle: 'output-n', target: 'out', targetHandle: 'value' },
      ],
    };

    const result = await runGraph({ graph, apiKey: '' });
    expect(result.status).toBe('completed');
    expect(result.nodeResults.lc.details.stopReason).toBe('max-iterations');
    expect(result.nodeResults.lc.details.iterationCount).toBe(3);
  });

  it('marks the run failed and is no longer running when a body node throws', async () => {
    registerNodeDefinition({
      type: 'transform',
      inputPorts: ['value'],
      outputPorts: ['result', 'continue'],
      async run() { throw new Error('simulated upstream 429'); },
    });

    const graph: Graph = {
      schemaVersion: 1, id: 'g', name: 'g', createdAt: '', updatedAt: '',
      containsCustomCode: false,
      nodes: [
        { id: 'seed', type: 'input', position: { x: 0, y: 0 }, config: { name: 'n', defaultValue: '0' } },
        { id: 'lc', type: 'loop-controller', position: { x: 0, y: 0 },
          config: { maxIterations: 3, valueChannels: [{ name: 'n' }] } },
        { id: 'inc', type: 'transform', position: { x: 0, y: 0 }, config: {} },
        { id: 'out', type: 'output', position: { x: 0, y: 0 }, config: { format: 'auto' } },
      ],
      edges: [
        { id: 'e1', source: 'seed', sourceHandle: 'text', target: 'lc', targetHandle: 'default-n' },
        { id: 'e2', source: 'lc', sourceHandle: 'output-n', target: 'inc', targetHandle: 'value' },
        { id: 'e3', source: 'inc', sourceHandle: 'result', target: 'lc', targetHandle: 'input-n' },
        { id: 'e4', source: 'inc', sourceHandle: 'continue', target: 'lc', targetHandle: 'continue' },
        { id: 'e5', source: 'lc', sourceHandle: 'output-n', target: 'out', targetHandle: 'value' },
      ],
    };

    const result = await runGraph({ graph, apiKey: '' });
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toMatch(/simulated upstream 429/);
    expect(result.nodeResults.inc.status).toBe('error');
    expect(result.nodeResults.lc.status).toBe('error');
    // Run store must reflect not-running so the UI Stop button releases.
    const runStore = useRunStore();
    expect(runStore.isRunning).toBe(false);
  });
});
