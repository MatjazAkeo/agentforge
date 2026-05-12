import type { Edge, Node } from '@/domain/graph';

const LANE_STEP = 24;

export function assignLanes(edges: Edge[], nodes: Node[]): Map<string, number> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const groups = new Map<string, Edge[]>();

  for (const e of edges) {
    // Group by target node only — edges entering the same node share an approach
    // corridor and need distinct lanes even when their target handles differ.
    // The lane offset shifts the routing path; each edge still peels off to its
    // own port at the very end.
    const key = e.target;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  const laneMap = new Map<string, number>();

  for (const group of groups.values()) {
    if (group.length <= 1) {
      laneMap.set(group[0].id, 0);
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const ay = nodeById.get(a.source)?.position.y ?? 0;
      const by = nodeById.get(b.source)?.position.y ?? 0;
      return ay - by;
    });
    const mid = (sorted.length - 1) / 2;
    sorted.forEach((edge, i) => laneMap.set(edge.id, (i - mid) * LANE_STEP));
  }

  return laneMap;
}
