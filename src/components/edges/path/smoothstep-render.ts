import type { Point } from './routing/types';

const DEFAULT_RADIUS = 30;

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function unit(a: Point, b: Point): Point {
  const len = distance(a, b);
  if (len === 0) return { x: 0, y: 0 };
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

function fmt(n: number): string {
  // Avoid trailing ".0" for integer coordinates; trim float to 3 dp for sub-pixel.
  return Number.isInteger(n) ? String(n) : Number(n.toFixed(3)).toString();
}

export function renderSmoothstep(waypoints: Point[], radius = DEFAULT_RADIUS): string {
  if (waypoints.length < 2) return '';
  if (waypoints.length === 2) {
    const [a, b] = waypoints;
    return `M${fmt(a.x)} ${fmt(a.y)} L${fmt(b.x)} ${fmt(b.y)}`;
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  let d = `M${fmt(first.x)} ${fmt(first.y)}`;

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];

    const prevSeg = distance(prev, curr);
    const nextSeg = distance(curr, next);
    const rEff = Math.min(radius, prevSeg / 2, nextSeg / 2);

    const uIn = unit(prev, curr);
    const uOut = unit(curr, next);

    const enter = { x: curr.x - uIn.x * rEff, y: curr.y - uIn.y * rEff };
    const exit  = { x: curr.x + uOut.x * rEff, y: curr.y + uOut.y * rEff };

    d += ` L${fmt(enter.x)} ${fmt(enter.y)}`;
    d += ` Q${fmt(curr.x)} ${fmt(curr.y)} ${fmt(exit.x)} ${fmt(exit.y)}`;
  }

  d += ` L${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}
