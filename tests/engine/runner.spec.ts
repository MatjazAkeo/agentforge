import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { runGraph } from '@/engine/runner';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { Graph } from '@/domain/graph';

// Importing the node modules registers them
import '@/nodes/input';
import '@/nodes/output';

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
