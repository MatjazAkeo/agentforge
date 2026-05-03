// src/persistence/graph-io.ts
import { graphSchema } from '@/domain/schemas';
import type { Graph } from '@/domain/graph';

export function serializeGraph(graph: Graph): string {
  return JSON.stringify(graph, null, 2);
}

export function parseGraph(json: string): Graph {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`Could not parse JSON: ${(e as Error).message}`);
  }
  const parsed = graphSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Graph file does not match schema: ${parsed.error.message}`);
  }
  // The schema permits any node config record; we trust it for now.
  return parsed.data as Graph;
}
