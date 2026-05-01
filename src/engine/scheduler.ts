import type { Graph } from '@/domain/graph';

/**
 * Returns a topological ordering of node ids. Throws if the graph contains a cycle.
 * Plan 1 has no Loop Controller; cycles are not yet allowed (loops are added in Plan 3).
 */
export function topologicalOrder(graph: Graph): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of graph.edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, d] of inDegree) if (d === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (order.length !== graph.nodes.length) {
    throw new Error('Graph contains a cycle (Loop Controller support is added in Plan 3)');
  }
  return order;
}

export function validateAcyclic(graph: Graph): void {
  topologicalOrder(graph);
}

/**
 * Returns a map from nodeId → list of incoming edges.
 */
export function incomingEdges(graph: Graph): Map<string, Graph['edges']> {
  const m = new Map<string, Graph['edges']>();
  for (const n of graph.nodes) m.set(n.id, []);
  for (const e of graph.edges) m.get(e.target)?.push(e);
  return m;
}
