import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBuildHelper = vi.fn();
vi.mock('@/flavors/sqlite', () => ({
  sqliteFlavor: {
    type: 'sqlite',
    helperName: 'sqlite',
    defaultConnection: { db: '', sourcePath: undefined, sizeBytes: 0 },
    buildHelper: (...args: unknown[]) => mockBuildHelper(...args),
  },
}));
vi.mock('@/flavors/registry', () => ({
  getFlavor: (t: string) => (t === 'sqlite' ? {
    type: 'sqlite',
    helperName: 'sqlite',
    buildHelper: (...args: unknown[]) => mockBuildHelper(...args),
  } : undefined),
  registerFlavor: vi.fn(),
}));

const mockRunInSandbox = vi.fn();
vi.mock('@/sandbox/runner', () => ({ runInSandbox: (...a: unknown[]) => mockRunInSandbox(...a) }));

import { toolPackNode, toolPackHelperFactories } from '@/nodes/tool-pack';
import type { Node } from '@/domain/graph';

beforeEach(() => {
  mockBuildHelper.mockReset();
  mockRunInSandbox.mockReset();
  toolPackHelperFactories.clear();
});

function makeNode(tools: Array<{ name: string; description: string; code: string; inputSchema?: object }>): Node {
  return {
    id: 'tp', type: 'tool-pack', position: { x: 0, y: 0 },
    config: {
      flavor: 'sqlite',
      connection: { db: 'users.db', sizeBytes: 16 },
      tools: tools.map((t) => ({
        name: t.name, description: t.description, code: t.code,
        inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
      })),
    },
  };
}

const ctxBase = () => ({
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
  graphFilePath: '/u/m/proj.graph.json',
});

describe('tool-pack node', () => {
  it('emits a tools wire with one ToolDefinitionPayload per configured tool', async () => {
    const node = makeNode([
      { name: 'AcListUsers', description: 'list users', code: 'return [];' },
      { name: 'AcFindUser', description: 'find user', code: 'return null;' },
    ]);
    const result = await toolPackNode.run(node, {}, ctxBase());
    expect(Array.isArray(result.tools)).toBe(true);
    const tools = result.tools as Array<{ name: string; description: string }>;
    expect(tools.map((t) => t.name)).toEqual(['AcListUsers', 'AcFindUser']);
  });

  it('emits empty tools array if no tools configured', async () => {
    const node = makeNode([]);
    const result = await toolPackNode.run(node, {}, ctxBase());
    expect(result.tools).toEqual([]);
  });

  it('the emitted tools carry name, description, code, inputSchema, toolId, timeoutMs', async () => {
    const node = makeNode([{ name: 'AcListUsers', description: 'list', code: 'return [];' }]);
    const result = await toolPackNode.run(node, {}, ctxBase());
    const tools = result.tools as Array<{ name: string; description: string; code: string; toolId: string; timeoutMs: number; inputSchema: object }>;
    expect(tools[0].name).toBe('AcListUsers');
    expect(tools[0].description).toBe('list');
    expect(tools[0].code).toBe('return [];');
    expect(tools[0].toolId).toContain('tp/');
    expect(typeof tools[0].timeoutMs).toBe('number');
  });

  it('registers a helper factory keyed by node id', async () => {
    const node = makeNode([{ name: 'X', description: '', code: '' }]);
    await toolPackNode.run(node, {}, ctxBase());
    expect(toolPackHelperFactories.has('tp')).toBe(true);
  });

  it('throws if flavor is unknown', async () => {
    const node: Node = {
      id: 'tp', type: 'tool-pack', position: { x: 0, y: 0 },
      config: { flavor: 'unknown' as 'sqlite', connection: {}, tools: [] },
    };
    await expect(toolPackNode.run(node, {}, ctxBase())).rejects.toThrow(/flavor/i);
  });
});
