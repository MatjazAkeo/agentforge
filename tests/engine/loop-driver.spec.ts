import { describe, it, expect, beforeEach } from 'vitest';
import { computeLoopBody } from '@/engine/loop-driver';
import type { Graph, Node, Edge } from '@/domain/graph';

function n(id: string, type: Node['type']): Node {
  return { id, type, position: { x: 0, y: 0 }, config: {} };
}
function e(id: string, source: string, target: string, sh = 'value', th = 'value'): Edge {
  return { id, source, sourceHandle: sh, target, targetHandle: th };
}
function g(nodes: Node[], edges: Edge[]): Graph {
  return { schemaVersion: 1, id: 'g', name: 'g', createdAt: '', updatedAt: '', nodes, edges, containsCustomCode: false };
}

describe('computeLoopBody', () => {
  it('returns nodes between LC outputs and the back-edge', () => {
    const graph = g(
      [n('input', 'input'), n('lc', 'loop-controller'), n('a', 'llm-call'), n('b', 'transform'), n('br', 'break'), n('out', 'output')],
      [
        e('1', 'input', 'lc', 'value', 'default-x'),
        e('2', 'lc', 'a', 'output-x', 'userMessage'),
        e('3', 'a', 'b', 'text', 'value'),
        e('4', 'b', 'lc', 'result', 'input-x'),
        e('5', 'b', 'br', 'result', 'value'),
        e('6', 'br', 'out', 'value', 'value'),
      ],
    );
    const body = computeLoopBody(graph, 'lc');
    expect(body.bodyNodeIds.sort()).toEqual(['a', 'b']);
    expect(body.breakNodeIds).toEqual(['br']);
  });

  it('returns empty body when LC has no back-edges', () => {
    const graph = g([n('lc', 'loop-controller')], []);
    const body = computeLoopBody(graph, 'lc');
    expect(body.bodyNodeIds).toEqual([]);
    expect(body.breakNodeIds).toEqual([]);
  });
});

import { driveLoop } from '@/engine/loop-driver';
import { setActivePinia, createPinia } from 'pinia';
import type { Run, NodeResult } from '@/domain/run';
import { registerNodeDefinition } from '@/nodes/registry';
import '@/nodes/loop-controller';
import '@/nodes/break';

function emptyResult(id: string): NodeResult {
  return { nodeId: id, status: 'idle', details: {} };
}

describe('driveLoop integration', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('iterates until continue is false, propagating the channel value', async () => {
    // Register a tiny "increment" body node for this test only.
    registerNodeDefinition({
      type: 'transform',
      inputPorts: ['value'],
      outputPorts: ['result', 'continue'],
      async run(_node, inputs) {
        const v = (inputs.value as number) + 1;
        return { result: v, continue: v < 3 };
      },
    });

    const graph = g(
      [
        n('seed', 'input'),
        { id: 'lc', type: 'loop-controller', position: { x: 0, y: 0 },
          config: { maxIterations: 10, valueChannels: [{ name: 'n' }] } },
        n('inc', 'transform'),
      ],
      [
        e('e1', 'seed', 'lc', 'value', 'default-n'),
        e('e2', 'lc', 'inc', 'output-n', 'value'),
        e('e3', 'inc', 'lc', 'result', 'input-n'),
        e('e4', 'inc', 'lc', 'continue', 'continue'),
      ],
    );

    const run: Run = {
      schemaVersion: 1, id: 'r', graphId: 'g',
      graphSnapshot: graph,
      startedAt: '', endedAt: null, status: 'running',
      inputs: {}, errors: [],
      nodeResults: {
        seed: emptyResult('seed'), lc: emptyResult('lc'), inc: emptyResult('inc'),
      },
    };
    const outputsByNode = new Map<string, Record<string, unknown>>([
      ['seed', { value: 0 }],
    ]);

    const out = await driveLoop({
      graph, run, controllerId: 'lc', outputsByNode,
      apiKey: '', signal: new AbortController().signal,
    });

    expect(out.iterationCount).toBe(3); // 0→1, 1→2, 2→3 (3 not <3, continue=false)
    expect(out.stopReason).toBe('continue-false');
    expect(run.nodeResults.inc.iterations?.length).toBe(3);
    expect(run.nodeResults.inc.iterations?.[2].output).toEqual({ result: 3, continue: false });
  });
});
