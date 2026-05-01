// src/domain/run.ts
import type { Graph } from './graph';

export type NodeStatus = 'idle' | 'running' | 'streaming' | 'done' | 'error';

export interface NodeResultDetails {
  // Plan 1 keeps this open; per-type details added by node implementations
  [key: string]: unknown;
}

export interface IterationRecord {
  iteration: number;
  startedAt: string;
  endedAt?: string;
  inputs: Record<string, unknown>;
  output?: unknown;
  details?: NodeResultDetails;
}

export interface NodeResult {
  nodeId: string;
  status: NodeStatus;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  iterations?: IterationRecord[];
  details: NodeResultDetails;
  errorMessage?: string;
  errorStack?: string;
}

export interface RunError {
  nodeId: string;
  message: string;
  stack?: string;
}

export type RunStatus = 'running' | 'completed' | 'failed' | 'aborted';

export interface Run {
  schemaVersion: 1;
  id: string;
  graphId: string;
  graphSnapshot: Graph;
  startedAt: string;
  endedAt: string | null;
  status: RunStatus;
  inputs: Record<string, unknown>;
  nodeResults: Record<string, NodeResult>;
  errors: RunError[];
}
