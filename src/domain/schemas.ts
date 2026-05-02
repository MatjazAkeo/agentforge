// src/domain/schemas.ts
import { z } from 'zod';

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const nodeSchema = z.object({
  // Node ids are not required to be UUIDs (e.g. Vue Flow may generate short
  // ids like 'a', 'b'). Only the top-level Graph id is a UUID.
  id: z.string(),
  type: z.enum([
    'input', 'output', 'llm-call', 'tool', 'tool-group', 'tool-runner',
    'prompt-template', 'transform', 'loop-controller', 'agent',
    'chat-input', 'chat-output',
  ]),
  position: positionSchema,
  config: z.record(z.string(), z.unknown()),
});

export const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string(),
  target: z.string(),
  targetHandle: z.string(),
});

export const graphSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  containsCustomCode: z.boolean(),
});

export type GraphFromSchema = z.infer<typeof graphSchema>;
