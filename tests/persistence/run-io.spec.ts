import { describe, it, expect } from 'vitest';
import { serializeRun, parseRun, runFileName, runsFolderForGraph } from '@/persistence/run-io';
import type { Run } from '@/domain/run';
import type { Graph } from '@/domain/graph';

describe('run-io', () => {
  const sampleGraph: Graph = {
    schemaVersion: 1, id: 'g1', name: 'g',
    createdAt: '', updatedAt: '', nodes: [], edges: [], containsCustomCode: false,
  };
  const sample: Run = {
    schemaVersion: 1, id: 'r12345-uuid', graphId: 'g1', graphSnapshot: sampleGraph,
    startedAt: '2026-05-02T10:00:00.000Z', endedAt: '2026-05-02T10:00:01.000Z',
    status: 'completed', inputs: {}, nodeResults: {}, errors: [],
  };

  it('round-trips a run through serialize/parse', () => {
    expect(parseRun(serializeRun(sample))).toEqual(sample);
  });

  it('runFileName uses safe filename', () => {
    const name = runFileName(sample);
    expect(name).toMatch(/^2026-05-02T10-00-00.+\.run\.json$/);
  });

  it('runsFolderForGraph derives folder from graph file path', () => {
    expect(runsFolderForGraph('/a/b/my-agent.graph.json')).toBe('/a/b/my-agent.runs');
    expect(runsFolderForGraph('/x/y/foo.graph.json')).toBe('/x/y/foo.runs');
  });
});
