import type { Graph, Edge } from '@/domain/graph';

/**
 * Tarjan's strongly-connected components. Returns an array of components,
 * where each component is an array of node ids that form a strongly connected
 * subgraph. Single-node components are included; a single node with a self-loop
 * is its own (cyclic) component, while a single node with no self-loop is
 * trivially its own (acyclic) component.
 */
export function findStronglyConnectedComponents(graph: Graph): string[][] {
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) adj.set(node.id, []);
  for (const edge of graph.edges) adj.get(edge.source)?.push(edge.target);

  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let index = 0;
  const components: string[][] = [];

  function strongConnect(v: string) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const component: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }
      components.push(component);
    }
  }

  for (const node of graph.nodes) {
    if (!indices.has(node.id)) strongConnect(node.id);
  }
  return components;
}

/**
 * True if a component is cyclic — either it has more than one node, or it
 * has exactly one node and that node has a self-loop edge in the graph.
 */
function isCyclicComponent(graph: Graph, component: string[]): boolean {
  if (component.length > 1) return true;
  const id = component[0];
  return graph.edges.some((e) => e.source === id && e.target === id);
}

/**
 * Returns the edges that close cycles in the graph. For each strongly connected
 * component containing a Loop Controller, returns every edge whose target IS
 * that Loop Controller AND whose source is in the same SCC. These are the
 * "back-edges" the runner needs to remove for topological ordering, and the
 * loop driver uses to know which iteration values to cycle.
 *
 * If a cyclic SCC does NOT contain exactly one Loop Controller,
 * `validateLoopTopology` will throw before this is consulted; this function
 * simply returns no edges for such components rather than guessing.
 */
export function findBackEdges(graph: Graph): Edge[] {
  const sccs = findStronglyConnectedComponents(graph);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const back: Edge[] = [];

  for (const component of sccs) {
    if (!isCyclicComponent(graph, component)) continue;
    const componentSet = new Set(component);
    const lcs = component.filter((id) => nodeById.get(id)?.type === 'loop-controller');
    if (lcs.length !== 1) continue;
    const lcId = lcs[0];
    for (const edge of graph.edges) {
      if (edge.target === lcId && componentSet.has(edge.source)) back.push(edge);
    }
  }
  return back;
}

/**
 * Throws if the graph contains any cycle that does not have a Loop Controller
 * as its anchor. Acyclic graphs always pass. Specifically:
 *  - Every strongly connected component with > 1 node (or a self-loop) must
 *    contain at least one `loop-controller` node.
 *  - Such a component must contain at most one `loop-controller` (no nesting).
 */
export function validateLoopTopology(graph: Graph): void {
  const sccs = findStronglyConnectedComponents(graph);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const component of sccs) {
    if (!isCyclicComponent(graph, component)) continue;
    const lcs = component.filter((id) => nodeById.get(id)?.type === 'loop-controller');
    if (lcs.length === 0) {
      throw new Error(
        `Cycle through nodes [${component.join(', ')}] is not allowed: ` +
        `every cycle must contain a Loop Controller node.`,
      );
    }
    if (lcs.length > 1) {
      throw new Error(
        `Nested Loop Controllers are not supported in v1: ` +
        `cycle contains [${lcs.join(', ')}].`,
      );
    }
  }
}
