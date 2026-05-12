import { describe, it, expect } from 'vitest';
import { routeWithLocalDetour } from './local-detour';
import type { BBox, PathInput } from './types';

function input(overrides: Partial<PathInput> = {}): PathInput {
  return {
    source: { x: 0, y: 100 },
    target: { x: 400, y: 100 },
    sourcePosition: 'right',
    targetPosition: 'left',
    obstacles: [],
    laneOffset: 0,
    ...overrides,
  };
}

describe('routeWithLocalDetour', () => {
  it('returns a direct path with no obstacles and same-y source/target', () => {
    const wp = routeWithLocalDetour(input());
    expect(wp).toEqual([
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ]);
  });

  it('returns a natural H-V-H step path when source and target differ in y', () => {
    const wp = routeWithLocalDetour(input({ target: { x: 400, y: 200 } }));
    expect(wp).toEqual([
      { x: 0, y: 100 },
      { x: 200, y: 100 },   // midX = (0+400)/2
      { x: 200, y: 200 },
      { x: 400, y: 200 },
    ]);
  });

  it('returns a straight diagonal when vertical step is below 30px (no lane offset)', () => {
    // Step of 15px is below the 30px threshold; falls back to a 2-waypoint diagonal.
    const wp = routeWithLocalDetour(input({ target: { x: 400, y: 115 } }));
    expect(wp).toEqual([
      { x: 0, y: 100 },
      { x: 400, y: 115 },
    ]);
  });

  it('uses a wrap-around U-shape for loop-back edges (source-right, target to the left of source)', () => {
    // Feedback edge pattern: source-right port, but target is to the LEFT of source.
    // Without wrap-around, the natural H-V-H midX would put the path through the
    // source node's body.
    const wp = routeWithLocalDetour(input({
      source: { x: 800, y: 600 },
      target: { x: 100, y: 200 },
    }));
    // EXIT_CLEARANCE = 30, WRAP_CHANNEL_OFFSET = 100.
    // exitX = 800 + 30 = 830, approachX = 100 - 30 = 70, channelY = min(600, 200) - 100 = 100.
    expect(wp).toEqual([
      { x: 800, y: 600 },
      { x: 830, y: 600 },
      { x: 830, y: 100 },
      { x: 70, y: 100 },
      { x: 70, y: 200 },
      { x: 100, y: 200 },
    ]);
  });

  it('keeps the H-V-H step pattern when laneOffset is nonzero, even if step is tiny', () => {
    // Step of 10px is below threshold, BUT laneOffset = 12 (would be from a 2-edge group)
    // forces the step to stay so lane spreading still works.
    const wp = routeWithLocalDetour(input({
      target: { x: 400, y: 110 },
      laneOffset: 12,
    }));
    // 4 waypoints: source, two corners at midX (212 = 200 + 12), target.
    expect(wp).toHaveLength(4);
    expect(wp[1]).toEqual({ x: 212, y: 100 });
    expect(wp[2]).toEqual({ x: 212, y: 110 });
  });

  it('routes over an obstacle on the source-target line (same-y case)', () => {
    // Obstacle straddles y=100 between source (0,100) and target (400,100).
    const obstacle: BBox = { x: 150, y: 80, w: 100, h: 40, nodeId: 'obs' };
    const wp = routeWithLocalDetour(input({ obstacles: [obstacle] }));
    // Inflated bbox: x [138, 262], y [68, 132].
    // Direct path at y=100 collides; obstacleCenterY=100, midpointY=100 → tie → top.
    // Detour: entry at (138, 100), up to (138, 68), across to (262, 68), down to (262, 100).
    expect(wp).toEqual([
      { x: 0, y: 100 },
      { x: 138, y: 100 },
      { x: 138, y: 68 },
      { x: 262, y: 68 },
      { x: 262, y: 100 },
      { x: 400, y: 100 },
    ]);
  });

  it('routes under an obstacle when the midpoint heuristic favors bottom', () => {
    // Obstacle's center is BELOW the source-target line → detour goes under.
    const obstacle: BBox = { x: 150, y: 100, w: 100, h: 40, nodeId: 'obs' };
    const wp = routeWithLocalDetour(input({ obstacles: [obstacle] }));
    // Inflated obstacle: x [138, 262], y [88, 152].
    // midpointY = 100, obstacleCenterY = 120 → goTop=false → bottom detour at y = 152.
    expect(wp).toContainEqual({ x: 138, y: 152 });
    expect(wp).toContainEqual({ x: 262, y: 152 });
  });

  it('applies 12px padding around obstacles on all sides', () => {
    const obstacle: BBox = { x: 150, y: 80, w: 100, h: 40, nodeId: 'obs' };
    const wp = routeWithLocalDetour(input({ obstacles: [obstacle] }));
    // Top detour at y = obstacle.y - 12 = 68. Entry/exit x = obstacle.x - 12 / obstacle.x + obstacle.w + 12.
    expect(wp).toContainEqual({ x: 138, y: 68 });
    expect(wp).toContainEqual({ x: 262, y: 68 });
  });

  it('handles two obstacles on the path with separate detours', () => {
    const obs1: BBox = { x: 80, y: 80, w: 60, h: 40, nodeId: 'a' };
    const obs2: BBox = { x: 250, y: 80, w: 60, h: 40, nodeId: 'b' };
    const wp = routeWithLocalDetour(input({ obstacles: [obs1, obs2] }));
    // Both straddle y=100. Each gets its own top detour.
    // First detour around obs1: inflated x [68, 152], y top = 68. Detour points should include those.
    // Second detour around obs2: inflated x [238, 322], y top = 68.
    expect(wp).toContainEqual({ x: 68, y: 68 });
    expect(wp).toContainEqual({ x: 152, y: 68 });
    expect(wp).toContainEqual({ x: 238, y: 68 });
    expect(wp).toContainEqual({ x: 322, y: 68 });
  });

  it('returns natural path when obstacles do not intersect any segment', () => {
    const obstacle: BBox = { x: 150, y: 300, w: 100, h: 40, nodeId: 'far' };
    const wp = routeWithLocalDetour(input({ obstacles: [obstacle] }));
    expect(wp).toEqual([
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ]);
  });

  it('shifts the detour height by laneOffset (top detour)', () => {
    const obstacle: BBox = { x: 150, y: 80, w: 100, h: 40, nodeId: 'obs' };
    const wp = routeWithLocalDetour(input({ obstacles: [obstacle], laneOffset: 8 }));
    // Top detour normally at y=68 → with laneOffset=8, push further up to y=60.
    expect(wp).toContainEqual({ x: 138, y: 60 });
    expect(wp).toContainEqual({ x: 262, y: 60 });
  });

  it('returns natural path for an edge with no obstacles', () => {
    const wp = routeWithLocalDetour(input({
      source: { x: 0, y: 100 },
      target: { x: 200, y: 100 },
    }));
    expect(wp).toEqual([
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]);
  });

  it('does not loop forever when no detour resolves the collision (safety cap)', () => {
    // Source/target both inside the same obstacle. Pathological case — should terminate
    // and return something rather than hang.
    const obstacle: BBox = { x: -100, y: -100, w: 800, h: 600, nodeId: 'huge' };
    const wp = routeWithLocalDetour(input({ obstacles: [obstacle] }));
    expect(wp.length).toBeGreaterThan(0);
    expect(wp.length).toBeLessThan(100);
  });
});
