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
});
