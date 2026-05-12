import type { BBox, PathInput, Point, PortPosition } from './types';

const OBSTACLE_PADDING = 12;
const MAX_DETOUR_ITERATIONS = 8;

interface InflatedRect { x1: number; y1: number; x2: number; y2: number; nodeId: string }
interface HSeg { kind: 'h'; y: number; xMin: number; xMax: number }
interface VSeg { kind: 'v'; x: number; yMin: number; yMax: number }
type Seg = HSeg | VSeg;

function inflate(rect: BBox): InflatedRect {
  return {
    x1: rect.x - OBSTACLE_PADDING,
    y1: rect.y - OBSTACLE_PADDING,
    x2: rect.x + rect.w + OBSTACLE_PADDING,
    y2: rect.y + rect.h + OBSTACLE_PADDING,
    nodeId: rect.nodeId,
  };
}

function makeSegment(a: Point, b: Point): Seg | null {
  if (a.x === b.x && a.y === b.y) return null;
  if (a.y === b.y) {
    return { kind: 'h', y: a.y, xMin: Math.min(a.x, b.x), xMax: Math.max(a.x, b.x) };
  }
  if (a.x === b.x) {
    return { kind: 'v', x: a.x, yMin: Math.min(a.y, b.y), yMax: Math.max(a.y, b.y) };
  }
  return null;
}

function intersects(seg: Seg, rect: InflatedRect): boolean {
  // Strict comparisons — a segment touching the inflated boundary (e.g., a
  // detour leg riding along it) is NOT a collision. This keeps detour legs
  // from being re-detected on the next iteration of the routing loop.
  if (seg.kind === 'h') {
    if (seg.y <= rect.y1 || seg.y >= rect.y2) return false;
    return seg.xMax > rect.x1 && seg.xMin < rect.x2;
  }
  if (seg.x <= rect.x1 || seg.x >= rect.x2) return false;
  return seg.yMax > rect.y1 && seg.yMin < rect.y2;
}

function isHorizontalFlow(srcPos: PortPosition, tgtPos: PortPosition): boolean {
  return (srcPos === 'left' || srcPos === 'right') && (tgtPos === 'left' || tgtPos === 'right');
}

function isVerticalFlow(srcPos: PortPosition, tgtPos: PortPosition): boolean {
  return (srcPos === 'top' || srcPos === 'bottom') && (tgtPos === 'top' || tgtPos === 'bottom');
}

function buildNaturalPath(input: PathInput): Point[] {
  const { source, target, sourcePosition, targetPosition, laneOffset = 0 } = input;

  if (isHorizontalFlow(sourcePosition, targetPosition)) {
    if (source.y === target.y) return [source, target];
    const midX = (source.x + target.x) / 2 + laneOffset;
    return [
      source,
      { x: midX, y: source.y },
      { x: midX, y: target.y },
      target,
    ];
  }

  if (isVerticalFlow(sourcePosition, targetPosition)) {
    if (source.x === target.x) return [source, target];
    const midY = (source.y + target.y) / 2 + laneOffset;
    return [
      source,
      { x: source.x, y: midY },
      { x: target.x, y: midY },
      target,
    ];
  }

  // Mixed orientations — single L-shape via the target's x at source's y.
  return [source, { x: target.x, y: source.y }, target];
}

function findFirstCollision(
  waypoints: Point[],
  obstacles: InflatedRect[],
): { segIdx: number; obstacle: InflatedRect } | null {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = makeSegment(waypoints[i], waypoints[i + 1]);
    if (!seg) continue;
    for (const obs of obstacles) {
      if (intersects(seg, obs)) return { segIdx: i, obstacle: obs };
    }
  }
  return null;
}

function chooseTopOrBottom(obstacle: InflatedRect, source: Point, target: Point): 'top' | 'bottom' {
  // Pick the side the obstacle's center is on relative to the source-target midpoint.
  // Detouring on the obstacle's own side minimizes path-length increase.
  const midpointY = (source.y + target.y) / 2;
  const obstacleCenterY = (obstacle.y1 + obstacle.y2) / 2;
  return obstacleCenterY <= midpointY ? 'top' : 'bottom';
}

function chooseLeftOrRight(obstacle: InflatedRect, source: Point, target: Point): 'left' | 'right' {
  const midpointX = (source.x + target.x) / 2;
  const obstacleCenterX = (obstacle.x1 + obstacle.x2) / 2;
  return obstacleCenterX <= midpointX ? 'left' : 'right';
}

function detourAroundHorizontal(
  segStart: Point,
  obstacle: InflatedRect,
  source: Point,
  target: Point,
  laneOffset: number,
): Point[] {
  const side = chooseTopOrBottom(obstacle, source, target);
  const detourY = side === 'top'
    ? obstacle.y1 - laneOffset
    : obstacle.y2 + laneOffset;
  const goingRight = segStart.x < (obstacle.x1 + obstacle.x2) / 2;
  const entryX = goingRight ? obstacle.x1 : obstacle.x2;
  const exitX  = goingRight ? obstacle.x2 : obstacle.x1;
  return [
    { x: entryX, y: segStart.y },
    { x: entryX, y: detourY },
    { x: exitX, y: detourY },
    { x: exitX, y: segStart.y },
  ];
}

function detourAroundVertical(
  segStart: Point,
  obstacle: InflatedRect,
  source: Point,
  target: Point,
  laneOffset: number,
): Point[] {
  const side = chooseLeftOrRight(obstacle, source, target);
  const detourX = side === 'left'
    ? obstacle.x1 - laneOffset
    : obstacle.x2 + laneOffset;
  const goingDown = segStart.y < (obstacle.y1 + obstacle.y2) / 2;
  const entryY = goingDown ? obstacle.y1 : obstacle.y2;
  const exitY  = goingDown ? obstacle.y2 : obstacle.y1;
  return [
    { x: segStart.x, y: entryY },
    { x: detourX, y: entryY },
    { x: detourX, y: exitY },
    { x: segStart.x, y: exitY },
  ];
}

function simplifyWaypoints(waypoints: Point[]): Point[] {
  if (waypoints.length <= 2) return waypoints;
  const out: Point[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = out[out.length - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    // Drop exact duplicates.
    if (prev.x === curr.x && prev.y === curr.y) continue;
    // Drop collinear midpoints (3 in a row on the same axis).
    if (prev.x === curr.x && curr.x === next.x) continue;
    if (prev.y === curr.y && curr.y === next.y) continue;
    out.push(curr);
  }
  const last = waypoints[waypoints.length - 1];
  if (out[out.length - 1].x !== last.x || out[out.length - 1].y !== last.y) out.push(last);
  return out;
}

export function routeWithLocalDetour(input: PathInput): Point[] {
  const laneOffset = input.laneOffset ?? 0;
  const inflatedObstacles = input.obstacles.map(inflate);

  let waypoints = buildNaturalPath(input);

  for (let iter = 0; iter < MAX_DETOUR_ITERATIONS; iter++) {
    const collision = findFirstCollision(waypoints, inflatedObstacles);
    if (!collision) break;

    const { segIdx, obstacle } = collision;
    const seg = makeSegment(waypoints[segIdx], waypoints[segIdx + 1])!;
    const detourPoints = seg.kind === 'h'
      ? detourAroundHorizontal(waypoints[segIdx], obstacle, input.source, input.target, laneOffset)
      : detourAroundVertical(waypoints[segIdx], obstacle, input.source, input.target, laneOffset);

    // Rebuild the rest of the path from the detour exit to the target. Any
    // pre-detour natural-path waypoints after the collision segment are now
    // stale (they'd cause backtracking through the obstacle's inflated bbox).
    const detourExit = detourPoints[detourPoints.length - 1];
    const restPath = buildNaturalPath({ ...input, source: detourExit, laneOffset: 0 });

    waypoints = [
      ...waypoints.slice(0, segIdx + 1),
      ...detourPoints,
      ...restPath.slice(1), // skip restPath[0] — it equals detourExit
    ];
  }

  return simplifyWaypoints(waypoints);
}
