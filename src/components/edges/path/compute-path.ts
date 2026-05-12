import type { PathInput, PathOutput } from './routing/types';
import { routeWithLocalDetour } from './routing/local-detour';
import { renderSmoothstep } from './smoothstep-render';

// Switch to 'pathfinding' when the A* strategy ships (future release).
const ACTIVE_ROUTING_STRATEGY: 'local-detour' | 'pathfinding' = 'local-detour';

export function computePath(input: PathInput): PathOutput {
  // Strategy dispatch is intentionally simple — the public surface stays the same
  // when 'pathfinding' is wired up later; only the routing function changes.
  const waypoints = ACTIVE_ROUTING_STRATEGY === 'local-detour'
    ? routeWithLocalDetour(input)
    : (() => { throw new Error('pathfinding strategy not implemented'); })();

  const d = renderSmoothstep(waypoints);
  return { waypoints, d };
}
