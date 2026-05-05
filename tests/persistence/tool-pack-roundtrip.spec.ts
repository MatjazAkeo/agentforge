import { describe, it, expect } from 'vitest';
import { parseGraph, serializeGraph } from '@/persistence/graph-io';
import type { Graph } from '@/domain/graph';

describe('tool-pack round-trip', () => {
  it('preserves config exactly through serialize → parse', () => {
    const g: Graph = {
      schemaVersion: 1,
      id: 'a3c1f4d2-1d5e-4a7b-8c9d-1234567890ab',
      name: 'tp-test',
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      nodes: [
        {
          id: 'tp', type: 'tool-pack', position: { x: 100, y: 100 },
          config: {
            flavor: 'sqlite',
            connection: { db: 'users.db', sourcePath: '/u/m/users.db', sizeBytes: 12345 },
            tools: [
              {
                name: 'AcListUsers',
                description: 'list users',
                inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
                code: 'return (await sqlite.query(\'SELECT * FROM users LIMIT :limit\', inputs)).rows;',
              },
              {
                name: 'AcFindUser',
                description: 'find',
                inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
                code: 'return (await sqlite.query(\'SELECT * FROM users WHERE name LIKE :q\', { q: \"%\" + inputs.q + \"%\" })).rows;',
                maxRows: 50,
              },
            ],
          },
        },
      ],
      edges: [],
      containsCustomCode: true,
    };
    const text = serializeGraph(g);
    const parsed = parseGraph(text);
    expect(parsed).toEqual(g);
  });

  it('round-trips an empty Tool Pack', () => {
    const g: Graph = {
      schemaVersion: 1,
      id: 'b4d2e5c3-2e6f-4b8c-9dae-2345678901bc',
      name: 'empty-tp',
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      nodes: [
        {
          id: 'tp',
          type: 'tool-pack',
          position: { x: 1, y: 2 },
          config: { flavor: 'sqlite', connection: { db: '', sourcePath: undefined, sizeBytes: 0 }, tools: [] },
        },
      ],
      edges: [],
      containsCustomCode: false,
    };
    const text = serializeGraph(g);
    const parsed = parseGraph(text);
    expect(parsed).toEqual(g);
  });
});
