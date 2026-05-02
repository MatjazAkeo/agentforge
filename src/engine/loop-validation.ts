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
 * Inline forward-reachability from a given source node, excluding back-edges
 * into that source (to avoid following the cycle back in).
 * Used to check for nested loop controllers without importing from loop-driver
 * (which would create a circular import).
 */
function forwardReachable(graph: Graph, sourceId: string): Set<string> {
  const fwd = new Map<string, string[]>();
  for (const node of graph.nodes) fwd.set(node.id, []);
  for (const edge of graph.edges) {
    if (edge.target === sourceId) continue; // skip edges back into the source
    fwd.get(edge.source)?.push(edge.target);
  }

  const reachable = new Set<string>();
  const stack: string[] = [sourceId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const targetId of fwd.get(id) ?? []) {
      if (!reachable.has(targetId)) {
        reachable.add(targetId);
        stack.push(targetId);
      }
    }
  }
  return reachable;
}

/**
 * Throws if any back-edge in the graph targets a node that is not a
 * `loop-controller`. Acyclic graphs always pass.
 * Also throws if any loop controller is nested inside another loop controller's body.
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

  // I2: reject nested loop controllers
  const loopControllers = graph.nodes.filter((n) => n.type === 'loop-controller');
  for (const lc of loopControllers) {
    const reachable = forwardReachable(graph, lc.id);
    for (const bodyId of reachable) {
      const bodyNode = nodeById.get(bodyId);
      if (bodyNode?.type === 'loop-controller') {
        throw new Error(
          `Nested Loop Controllers are not supported in v1: "${lc.id}" contains "${bodyId}".`,
        );
      }
    }
  }
}
