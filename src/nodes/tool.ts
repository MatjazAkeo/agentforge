// src/nodes/tool.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolConfig } from '@/domain/node-types';

export interface ToolDefinitionPayload {
  toolId: string;          // Node id — used by Tool Runner to look up the source code
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  code: string;
  timeoutMs: number;
}

export const toolNode: NodeDefinition = {
  type: 'tool',
  inputPorts: [],
  outputPorts: ['toolDefinition'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as ToolConfig;
    const payload: ToolDefinitionPayload = {
      toolId: node.id,
      name: cfg.name,
      description: cfg.description,
      inputSchema: cfg.inputSchema,
      code: cfg.code,
      timeoutMs: cfg.timeoutMs ?? 30_000,
    };
    ctx.details.definition = payload;
    return { toolDefinition: [payload] };  // single-element array so Tool Group can flatten cleanly
  },
};

registerNodeDefinition(toolNode);
