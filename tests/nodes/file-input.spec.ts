import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReadAssetBytes = vi.fn();
const mockAssetExists = vi.fn();
vi.mock('@/persistence/assets-dir', () => ({
  readAssetBytes: (...a: unknown[]) => mockReadAssetBytes(...a),
  assetExists: (...a: unknown[]) => mockAssetExists(...a),
}));

const mockExtractText = vi.fn();
vi.mock('@/files/extract', async () => {
  const actual = await vi.importActual<typeof import('@/files/extract')>('@/files/extract');
  return {
    ...actual,
    extractText: (...a: unknown[]) => mockExtractText(...a),
  };
});

import { fileInputNode } from '@/nodes/file-input';
import type { Node } from '@/domain/graph';

beforeEach(() => {
  mockReadAssetBytes.mockReset();
  mockAssetExists.mockReset();
  mockExtractText.mockReset();
});

function makeNode(files: Array<{ filename: string; sizeBytes: number }>): Node {
  return {
    id: 'fi', type: 'file-input', position: { x: 0, y: 0 },
    config: { files },
  };
}

const ctxBase = () => ({
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
  graphFilePath: '/u/m/proj.graph.json',
});

describe('file-input node', () => {
  it('emits empty string for an empty file list', async () => {
    const result = await fileInputNode.run(makeNode([]), {}, ctxBase());
    expect(result).toEqual({ text: '' });
  });

  it('reads, extracts, and wraps a single txt file', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    mockExtractText.mockResolvedValue('hello');
    const result = await fileInputNode.run(
      makeNode([{ filename: 'notes.txt', sizeBytes: 5 }]),
      {}, ctxBase(),
    );
    expect(result).toEqual({ text: '<file name="notes.txt">\nhello\n</file>' });
    expect(mockExtractText).toHaveBeenCalledWith(expect.anything(), 'txt');
  });

  it('concatenates multiple files in declared order', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    mockExtractText.mockResolvedValueOnce('A').mockResolvedValueOnce('B');
    const result = await fileInputNode.run(
      makeNode([
        { filename: 'a.txt', sizeBytes: 1 },
        { filename: 'b.json', sizeBytes: 1 },
      ]),
      {}, ctxBase(),
    );
    expect(result).toEqual({
      text: '<file name="a.txt">\nA\n</file>\n\n<file name="b.json">\nB\n</file>',
    });
  });

  it('throws if a referenced asset is missing', async () => {
    mockAssetExists.mockResolvedValue(false);
    await expect(
      fileInputNode.run(makeNode([{ filename: 'gone.txt', sizeBytes: 1 }]), {}, ctxBase()),
    ).rejects.toThrow(/missing asset/);
  });

  it('throws if the graph is unsaved (graphFilePath is null)', async () => {
    const ctx = { ...ctxBase(), graphFilePath: null };
    await expect(
      fileInputNode.run(makeNode([{ filename: 'a.txt', sizeBytes: 1 }]), {}, ctx),
    ).rejects.toThrow(/save the graph/i);
  });

  it('records empty-extraction warnings in details', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    mockExtractText.mockResolvedValue('');
    const ctx = ctxBase();
    await fileInputNode.run(makeNode([{ filename: 'scan.pdf', sizeBytes: 1 }]), {}, ctx);
    expect(ctx.details.emptyFiles).toEqual(['scan.pdf']);
  });
});
