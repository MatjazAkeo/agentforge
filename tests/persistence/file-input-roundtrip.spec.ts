import { describe, it, expect } from 'vitest';
import { parseGraph, serializeGraph } from '@/persistence/graph-io';
import type { Graph } from '@/domain/graph';

describe('file-input round-trip', () => {
  it('preserves the files array exactly through serialize → parse', () => {
    const g: Graph = {
      schemaVersion: 1,
      id: 'a3c1f4d2-1d5e-4a7b-8c9d-1234567890ab',
      name: 'rag-test',
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
      nodes: [
        {
          id: 'fi',
          type: 'file-input',
          position: { x: 0, y: 0 },
          config: {
            files: [
              { filename: 'spec.pdf', sizeBytes: 12345, sourcePath: '/u/m/spec.pdf' },
              { filename: 'notes-2.txt', sizeBytes: 7, sourcePath: '/u/m/notes.txt' },
            ],
          },
        },
      ],
      edges: [],
      containsCustomCode: false,
    };
    const text = serializeGraph(g);
    const parsed = parseGraph(text);
    expect(parsed).toEqual(g);
  });

  it('round-trips an empty file-input config', () => {
    const g: Graph = {
      schemaVersion: 1,
      id: 'b4d2e5c3-2e6f-4b8c-9dae-2345678901bc',
      name: 'empty-fi',
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
      nodes: [
        { id: 'fi', type: 'file-input', position: { x: 1, y: 2 }, config: { files: [] } },
      ],
      edges: [],
      containsCustomCode: false,
    };
    const text = serializeGraph(g);
    const parsed = parseGraph(text);
    expect(parsed).toEqual(g);
  });
});
