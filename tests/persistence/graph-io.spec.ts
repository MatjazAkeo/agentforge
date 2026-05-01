import { describe, it, expect } from 'vitest';
import { serializeGraph, parseGraph } from '@/persistence/graph-io';
import type { Graph } from '@/domain/graph';

describe('graph-io', () => {
  const sample: Graph = {
    schemaVersion: 1,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Test',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    nodes: [
      { id: '22222222-2222-4222-8222-222222222222', type: 'input', position: { x: 0, y: 0 }, config: { name: 'q', valueType: 'text', defaultValue: '' } },
    ],
    edges: [],
    containsCustomCode: false,
  };

  it('round-trips a graph through serialize/parse', () => {
    const json = serializeGraph(sample);
    const parsed = parseGraph(json);
    expect(parsed).toEqual(sample);
  });

  it('throws a friendly error on schema mismatch', () => {
    expect(() => parseGraph('{"schemaVersion": 99}')).toThrow(/schema/i);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseGraph('not json')).toThrow(/JSON/);
  });
});
