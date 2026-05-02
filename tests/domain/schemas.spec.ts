import { describe, it, expect } from 'vitest';
import { graphSchema } from '@/domain/schemas';

describe('graphSchema', () => {
  const validGraph = {
    schemaVersion: 1,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Test',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    nodes: [],
    edges: [],
    containsCustomCode: false,
  };

  it('accepts a minimal valid graph', () => {
    expect(graphSchema.safeParse(validGraph).success).toBe(true);
  });

  it('rejects a graph with wrong schemaVersion', () => {
    const bad = { ...validGraph, schemaVersion: 99 };
    expect(graphSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a graph missing required fields', () => {
    const bad: any = { ...validGraph };
    delete bad.id;
    expect(graphSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a graph with one Input and one Output node', () => {
    const graph = {
      ...validGraph,
      nodes: [
        { id: 'a', type: 'input', position: { x: 0, y: 0 }, config: { name: 'q', defaultValue: '' } },
        { id: 'b', type: 'output', position: { x: 200, y: 0 }, config: { format: 'auto' } },
      ],
      edges: [
        { id: 'e1', source: 'a', sourceHandle: 'value', target: 'b', targetHandle: 'value' },
      ],
    };
    expect(graphSchema.safeParse(graph).success).toBe(true);
  });
});
