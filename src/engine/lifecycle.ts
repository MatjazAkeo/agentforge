import type { NodeStatus } from '@/domain/run';

export const TERMINAL: ReadonlySet<NodeStatus> = new Set(['done', 'error']);

export function canTransition(from: NodeStatus, to: NodeStatus): boolean {
  if (from === 'idle') return to === 'running' || to === 'error';
  if (from === 'running') return to === 'streaming' || to === 'done' || to === 'error';
  if (from === 'streaming') return to === 'done' || to === 'error';
  return false;
}
