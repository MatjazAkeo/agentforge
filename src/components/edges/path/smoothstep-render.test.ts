import { describe, it, expect } from 'vitest';
import { renderSmoothstep } from './smoothstep-render';
import type { Point } from './routing/types';

describe('renderSmoothstep', () => {
  it('returns empty string for fewer than 2 waypoints', () => {
    expect(renderSmoothstep([])).toBe('');
    expect(renderSmoothstep([{ x: 0, y: 0 }])).toBe('');
  });

  it('renders a 2-waypoint path as a single L command', () => {
    const wp: Point[] = [{ x: 10, y: 20 }, { x: 110, y: 20 }];
    expect(renderSmoothstep(wp)).toBe('M10 20 L110 20');
  });

  it('rounds each interior corner with r=30 by default', () => {
    // L-shape: (0,0) → (100,0) → (100,100). One interior corner at (100,0).
    const wp: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const d = renderSmoothstep(wp);
    // Expect a 30-unit straight before the corner, then Q, then continue.
    expect(d).toContain('M0 0');
    expect(d).toContain('L70 0');             // 100 - 30 = 70 (enter the corner)
    expect(d).toContain('Q100 0 100 30');     // anchor at the corner, exit 30 below
    expect(d).toContain('L100 100');          // final straight to target
  });

  it('clamps corner radius to half the shorter adjacent segment', () => {
    // Adjacent segments only 20 units each. r=30 must clamp to 10 (= 20/2).
    const wp: Point[] = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }];
    const d = renderSmoothstep(wp);
    expect(d).toContain('L10 0');             // 20 - 10 = 10
    expect(d).toContain('Q20 0 20 10');       // anchor, exit 10 below
    expect(d).toContain('L20 20');
  });

  it('handles two adjacent corners where rounds nearly meet (kissing)', () => {
    // Three corners with a very short middle segment.
    // (0,0) → (100,0) → (100,40) → (200,40)
    // Middle segment is 40 units, so r at both corners on that segment clamps to 20.
    const wp: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 200, y: 40 },
    ];
    const d = renderSmoothstep(wp);
    // First corner clamped to 20 by middle segment; entry at y=0 stays at L70 0 (radius 30 on long segment)
    // Wait — the first segment is 100 units long (0..100), the middle is 40 (0..40 in y).
    // First corner r_eff = min(30, 100/2=50, 40/2=20) = 20.
    expect(d).toContain('L80 0');             // 100 - 20 = 80
    expect(d).toContain('Q100 0 100 20');     // anchor, exit 20 below (40 - 20 = 20)
    // Second corner: prev segment (100,0)→(100,40) length 40 → half=20; next segment (100,40)→(200,40) length 100 → half=50. r_eff = min(30, 20, 50) = 20.
    expect(d).toContain('Q100 40 120 40');    // anchor at (100,40), exit at (120,40)
    expect(d).toContain('L200 40');
  });

  it('handles vertical-then-horizontal corner orientation', () => {
    // (0,0) → (0,100) → (100,100). Corner at (0,100) where prev is V, next is H.
    const wp: Point[] = [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }];
    const d = renderSmoothstep(wp);
    expect(d).toContain('M0 0');
    expect(d).toContain('L0 70');             // enter 30 above the corner
    expect(d).toContain('Q0 100 30 100');     // anchor, exit 30 to the right
    expect(d).toContain('L100 100');
  });
});
