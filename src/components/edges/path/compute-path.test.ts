import { describe, it, expect } from 'vitest';
import { computePath } from './compute-path';
import type { PathInput } from './routing/types';

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

describe('computePath', () => {
  it('produces both waypoints and a d-string', () => {
    const out = computePath(input());
    expect(out.waypoints).toEqual([
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ]);
    expect(out.d).toBe('M0 100 L400 100');
  });

  it('renders a smoothstep d-string from a routed path', () => {
    const out = computePath(input({
      target: { x: 400, y: 200 },
    }));
    // Natural H-V-H step with midX=200; 4 waypoints; smoothstep applies r=30 corners.
    expect(out.waypoints).toHaveLength(4);
    expect(out.d).toContain('M0 100');
    expect(out.d).toContain('Q200 100'); // anchor at first corner
    expect(out.d).toContain('L400 200');
  });

  it('passes laneOffset through to the routing strategy', () => {
    const obstacle = { x: 150, y: 80, w: 100, h: 40, nodeId: 'obs' };
    const noLane = computePath(input({ obstacles: [obstacle], laneOffset: 0 }));
    const withLane = computePath(input({ obstacles: [obstacle], laneOffset: 8 }));
    // With lane offset, the detour y should differ by 8.
    const noLaneTops = noLane.waypoints.map((p) => p.y);
    const withLaneTops = withLane.waypoints.map((p) => p.y);
    expect(Math.min(...withLaneTops)).toBeLessThan(Math.min(...noLaneTops));
  });
});
