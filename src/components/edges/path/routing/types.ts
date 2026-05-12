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
  /** Obstacle bboxes EXCLUDING the source and target node bboxes. */
  obstacles: BBox[];
  /** Perpendicular shift in px for parallel-edge spreading. Default 0. */
  laneOffset?: number;
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
}
