import { describe, it, expect } from 'vitest';
import { findBackEdges, validateLoopTopology } from '@/engine/loop-validation';
import type { Graph, Node, Edge } from '@/domain/graph';

function n(id: string, type: Node['type'] = 'input'): Node {
  return { id, type, position: { x: 0, y: 0 }, config: {} };
}
function e(id: string, source: string, target: string, sourceHandle = 'value', targetHandle = 'value'): Edge {
  return { id, source, sourceHandle, target, targetHandle };
}
function g(nodes: Node[], edges: Edge[]): Graph {
  return { schemaVersion: 1, id: 'g', name: 'g', createdAt: '', updatedAt: '', nodes, edges, containsCustomCode: false };
}

describe('findBackEdges', () => {
  it('returns [] for an acyclic graph', () => {
    const graph = g([n('a'), n('b'), n('c')], [e('1', 'a', 'b'), e('2', 'b', 'c')]);
    expect(findBackEdges(graph)).toEqual([]);
  });

  it('finds the back-edge in a simple cycle', () => {
    const graph = g(
      [n('a'), n('lc', 'loop-controller'), n('body')],
      [e('1', 'a', 'lc'), e('2', 'lc', 'body'), e('3', 'body', 'lc')],
    );
    const back = findBackEdges(graph);
    expect(back.map((x) => x.id)).toEqual(['3']);
  });

  it('returns no back-edges for a self-loop on a non-LC node (validateLoopTopology rejects)', () => {
    // Under the SCC model, a cycle without a Loop Controller is invalid; findBackEdges
    // returns nothing because there is no anchor to associate the back-edge with.
    // validateLoopTopology surfaces the error.
    const graph = g([n('a')], [e('1', 'a', 'a')]);
    expect(findBackEdges(graph)).toEqual([]);
    expect(() => validateLoopTopology(graph)).toThrow(/Loop Controller/i);
  });

  it('treats a self-loop on a Loop Controller as a back-edge', () => {
    const graph = g([n('lc', 'loop-controller')], [e('1', 'lc', 'lc')]);
    const back = findBackEdges(graph);
    expect(back.map((x) => x.id)).toEqual(['1']);
  });

  it('returns back-edges with order-independence — labels the edge into the LC even when DFS would visit the LC last', () => {
    // Reproduces the bug fixed by switching to SCC-based detection: when an extra
    // forward edge ('in' → 'body' before 'in' → 'lc') changes DFS visit order,
    // the back-edge classification must not flip from `body → lc` to `lc → body`.
    const graph = g(
      [n('in', 'input'), n('lc', 'loop-controller'), n('body')],
      [
        e('e0', 'in', 'body'),     // visits body first
        e('e1', 'in', 'lc'),
        e('e2', 'lc', 'body'),     // would be the "back-edge" under naive DFS
        e('e3', 'body', 'lc'),     // the actual cycle-closing edge
      ],
    );
    expect(findBackEdges(graph).map((x) => x.id)).toEqual(['e3']);
    expect(() => validateLoopTopology(graph)).not.toThrow();
  });

  it('handles disjoint components — only the cyclic one yields back-edges', () => {
    const graph = g(
      [n('a'), n('b'), n('lc', 'loop-controller'), n('body')],
      [e('1', 'a', 'b'), e('2', 'lc', 'body'), e('3', 'body', 'lc')],
    );
    expect(findBackEdges(graph).map((x) => x.id)).toEqual(['3']);
  });
});

describe('validateLoopTopology', () => {
  it('passes for an acyclic graph', () => {
    const graph = g([n('a'), n('b')], [e('1', 'a', 'b')]);
    expect(() => validateLoopTopology(graph)).not.toThrow();
  });

  it('passes when every back-edge targets a loop-controller', () => {
    const graph = g(
      [n('a'), n('lc', 'loop-controller'), n('body')],
      [e('1', 'a', 'lc'), e('2', 'lc', 'body'), e('3', 'body', 'lc')],
    );
    expect(() => validateLoopTopology(graph)).not.toThrow();
  });

  it('throws when a back-edge targets a non-controller node', () => {
    const graph = g(
      [n('a'), n('b'), n('c')],
      [e('1', 'a', 'b'), e('2', 'b', 'c'), e('3', 'c', 'b')],
    );
    expect(() => validateLoopTopology(graph)).toThrow(/Loop Controller/i);
  });

  it('throws when only one of multiple back-edges is invalid', () => {
    // Two cycles: one through a loop-controller (legal), one through a regular node (illegal).
    const graph = g(
      [n('a'), n('lc', 'loop-controller'), n('b'), n('c')],
      [
        e('1', 'a', 'lc'), e('2', 'lc', 'a'),     // legal back-edge: target is loop-controller
        e('3', 'b', 'c'), e('4', 'c', 'b'),       // illegal back-edge: target is plain node
      ],
    );
    expect(() => validateLoopTopology(graph)).toThrow(/Loop Controller/i);
  });

  it('rejects nested loop controllers', () => {
    const graph = g(
      [n('lc1', 'loop-controller'), n('lc2', 'loop-controller'), n('body')],
      [
        e('1', 'lc1', 'lc2', 'output-x', 'default-y'),
        e('2', 'lc2', 'body', 'output-y', 'value'),
        e('3', 'body', 'lc2', 'value', 'input-y'),
        e('4', 'lc2', 'lc1', 'output-y', 'input-x'),
      ],
    );
    expect(() => validateLoopTopology(graph)).toThrow(/[Nn]ested/);
  });
});
