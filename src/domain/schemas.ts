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
    'chat-input', 'chat-output', 'file-input', 'tool-pack',
    'context-group',
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
  // Graph id is an internal identifier — usually a UUID generated at create time,
  // but bundled templates ship with stable string ids like 'tmpl-01-hello-model'.
  // Accept any non-empty string so saved-then-reopened graphs from templates parse cleanly.
  id: z.string().min(1),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  containsCustomCode: z.boolean(),
});

export type GraphFromSchema = z.infer<typeof graphSchema>;
