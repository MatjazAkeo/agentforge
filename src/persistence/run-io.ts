// src/persistence/run-io.ts
import type { Run } from '@/domain/run';

export function serializeRun(run: Run): string {
  return JSON.stringify(run, null, 2);
}

export function parseRun(json: string): Run {
  return JSON.parse(json) as Run;
}

export function runFileName(run: Run): string {
  // ISO timestamp with `:` and `.` replaced (filesystem-safe), plus first 6 of id.
  const safe = run.startedAt.replace(/[:.]/g, '-');
  return `${safe}-${run.id.slice(0, 6)}.run.json`;
}

/** Folder convention: <graphFile-without-.graph.json>.runs/ next to the graph file. */
export function runsFolderForGraph(graphFilePath: string): string {
  return graphFilePath.replace(/\.graph\.json$/, '') + '.runs';
}
