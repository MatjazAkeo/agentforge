import type { Graph, Edge } from '@/domain/graph';

/**
 * Computes a topological order using only forward edges, treating any edge
 * that would require visiting an unvisited cycle as a back-edge to skip.
 *
 * Algorithm: DFS with white/gray/black marks. An edge (u, v) where v is gray
 * (currently on the stack) is a back-edge.
 */
export function findBackEdges(graph: Graph): Edge[] {
  // Note: the SET of back-edges is well-defined for a given DFS root order, but
  // which specific edge in a cycle is labelled the back-edge depends on the order
  // of `graph.nodes`. The validator only cares that some such edge points at a
  // Loop Controller, so this is acceptable. Callers that strip back-edges by id
  // (e.g. topologicalOrderIgnoringBackEdges) get a stable result for a stable
  // node order.
  const adj = new Map<string, Edge[]>();
  for (const node of graph.nodes) adj.set(node.id, []);
  for (const edge of graph.edges) adj.get(edge.source)?.push(edge);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const node of graph.nodes) color.set(node.id, WHITE);

  const back: Edge[] = [];

  function visit(id: string) {
    color.set(id, GRAY);
    for (const edge of adj.get(id) ?? []) {
      const c = color.get(edge.target);
      if (c === GRAY) back.push(edge);
      else if (c === WHITE) visit(edge.target);
    }
    color.set(id, BLACK);
  }

  for (const node of graph.nodes) {
    if (color.get(node.id) === WHITE) visit(node.id);
  }
  return back;
}

/**
 * Throws if any back-edge in the graph targets a node that is not a
 * `loop-controller`. Acyclic graphs always pass.
 */
export function validateLoopTopology(graph: Graph): void {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const back = findBackEdges(graph);
  for (const edge of back) {
    const target = nodeById.get(edge.target);
    if (!target || target.type !== 'loop-controller') {
      throw new Error(
        `Cycle through edge "${edge.id}" (${edge.source} → ${edge.target}) is not allowed: ` +
        `the only nodes that may receive back-edges are Loop Controllers.`,
      );
    }
  }
}
