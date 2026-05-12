import { describe, it, expect } from 'vitest';
import { assignLanes } from './assign-lanes';
import type { Edge, Node } from '@/domain/graph';

function node(id: string, y: number): Node {
  return { id, type: 'input', position: { x: 0, y }, config: {} };
}

function edge(id: string, source: string, target: string, targetHandle: string): Edge {
  return { id, source, sourceHandle: 'context', target, targetHandle };
}

describe('assignLanes', () => {
  it('assigns offset 0 to a singleton edge', () => {
    const nodes = [node('a', 0), node('t', 100)];
    const edges = [edge('e1', 'a', 't', 'contexts')];
    const lanes = assignLanes(edges, nodes);
    expect(lanes.get('e1')).toBe(0);
  });

  it('assigns symmetric offsets to a 2-edge group (24px port pitch)', () => {
    const nodes = [node('a', 10), node('b', 200), node('t', 100)];
    const edges = [
      edge('e1', 'a', 't', 'contexts'),
      edge('e2', 'b', 't', 'contexts'),
    ];
    const lanes = assignLanes(edges, nodes);
    // LANE_STEP = 24 (matches port pitch); 2 edges symmetric → ±12.
    expect(lanes.get('e1')).toBe(-12); // top source
    expect(lanes.get('e2')).toBe(+12); // bottom source
  });

  it('assigns symmetric offsets to a 4-edge group', () => {
    const nodes = [node('a', 0), node('b', 50), node('c', 100), node('d', 150), node('t', 75)];
    const edges = [
      edge('e1', 'a', 't', 'contexts'),
      edge('e2', 'b', 't', 'contexts'),
      edge('e3', 'c', 't', 'contexts'),
      edge('e4', 'd', 't', 'contexts'),
    ];
    const lanes = assignLanes(edges, nodes);
    // 4 edges with step 24 → [-36, -12, +12, +36].
    expect(lanes.get('e1')).toBe(-36);
    expect(lanes.get('e2')).toBe(-12);
    expect(lanes.get('e3')).toBe(+12);
    expect(lanes.get('e4')).toBe(+36);
  });

  it('does not let independent target groups interact', () => {
    const nodes = [node('a', 0), node('b', 100), node('t1', 50), node('t2', 50)];
    const edges = [
      edge('e1', 'a', 't1', 'contexts'),
      edge('e2', 'b', 't1', 'contexts'),
      edge('e3', 'a', 't2', 'contexts'),
    ];
    const lanes = assignLanes(edges, nodes);
    // e1, e2 share target t1 (2-edge group); e3 alone.
    expect(lanes.get('e1')).toBe(-12);
    expect(lanes.get('e2')).toBe(+12);
    expect(lanes.get('e3')).toBe(0);
  });

  it('groups by target node regardless of target handle', () => {
    const nodes = [node('a', 0), node('b', 100), node('t', 50)];
    const edges = [
      edge('e1', 'a', 't', 'context'),    // different handle…
      edge('e2', 'b', 't', 'contexts'),   // …same target node — still groups
    ];
    const lanes = assignLanes(edges, nodes);
    expect(lanes.get('e1')).toBe(-12);
    expect(lanes.get('e2')).toBe(+12);
  });
});
