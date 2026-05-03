import { describe, it, expect } from 'vitest';
import { topologicalOrder, validateAcyclic } from '@/engine/scheduler';
import type { Graph } from '@/domain/graph';

function makeGraph(nodeIds: string[], edges: Array<[string, string]>): Graph {
  return {
    schemaVersion: 1, id: 'g', name: 'g',
    createdAt: '', updatedAt: '',
    nodes: nodeIds.map((id) => ({ id, type: 'input', position: { x: 0, y: 0 }, config: {} })),
    edges: edges.map(([s, t], i) => ({ id: `e${i}`, source: s, sourceHandle: 'value', target: t, targetHandle: 'value' })),
    containsCustomCode: false,
  };
}

describe('topologicalOrder', () => {
  it('orders a linear chain', () => {
    const g = makeGraph(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]);
    expect(topologicalOrder(g)).toEqual(['a', 'b', 'c']);
  });

  it('orders parallel branches', () => {
    const g = makeGraph(['a', 'b1', 'b2', 'c'], [['a', 'b1'], ['a', 'b2'], ['b1', 'c'], ['b2', 'c']]);
    const order = topologicalOrder(g);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b1'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b2'));
    expect(order.indexOf('b1')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b2')).toBeLessThan(order.indexOf('c'));
  });

  it('throws on a cycle', () => {
    const g = makeGraph(['a', 'b'], [['a', 'b'], ['b', 'a']]);
    expect(() => topologicalOrder(g)).toThrow(/cycle/i);
  });
});

describe('validateAcyclic', () => {
  it('passes on a DAG', () => {
    const g = makeGraph(['a', 'b'], [['a', 'b']]);
    expect(() => validateAcyclic(g)).not.toThrow();
  });

  it('throws on a self-loop', () => {
    const g = makeGraph(['a'], [['a', 'a']]);
    expect(() => validateAcyclic(g)).toThrow(/cycle/i);
  });
});
