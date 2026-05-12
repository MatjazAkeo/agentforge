import type { DataType } from '@/nodes/port-types';

export interface Point {
  x: number;
  y: number;
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
  nodeId: string;
}

export type PortPosition = 'left' | 'right' | 'top' | 'bottom';

export interface PathInput {
  source: Point;
  target: Point;
  sourcePosition: PortPosition;
  targetPosition: PortPosition;
  /** Obstacle bboxes. INCLUDES source and target node bboxes; first and last
   *  path segments skip collision detection on those specifically. */
  obstacles: BBox[];
  /** Perpendicular shift in px for parallel-edge spreading. Default 0. */
  laneOffset?: number;
  /** Source node id — used to skip collision detection on the source bbox
   *  for the first path segment (which is allowed to start inside it). */
  sourceNodeId?: string;
  /** Target node id — same for the last path segment. */
  targetNodeId?: string;
}

export interface PathOutput {
  /** Includes source and target as first/last entries. */
  waypoints: Point[];
  /** SVG `d` string ready for `<path d="…">`. */
  d: string;
}

/** Per-edge data attached to Vue Flow edge.data so RoutedEdge can render. */
export interface RoutedEdgeData {
  wireType: DataType | null;
  obstacles: BBox[];
  laneOffset: number;
  sourceNodeId: string;
  targetNodeId: string;
}
