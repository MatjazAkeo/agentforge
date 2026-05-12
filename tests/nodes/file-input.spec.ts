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

vi.mock('@/files/image', () => ({
  bytesToBase64: vi.fn(() => 'AQID'),
  optimizeImage: vi.fn(),
}));

import { fileInputNode } from '@/nodes/file-input';
import type { Node } from '@/domain/graph';

beforeEach(() => {
  mockReadAssetBytes.mockReset();
  mockAssetExists.mockReset();
  mockExtractText.mockReset();
});

function makeNode(files: Array<{ filename: string; sizeBytes: number; kind?: 'text' | 'image'; mime?: string }>): Node {
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

describe('file-input node — context output', () => {
  it('emits an empty user message when no files are configured', async () => {
    const result = await fileInputNode.run(makeNode([]), {}, ctxBase());
    expect(result).toEqual({ context: [{ role: 'user', content: '' }] });
  });

  it('emits a single user message with wrapped text content for a txt file', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    mockExtractText.mockResolvedValue('hello');
    const result = await fileInputNode.run(
      makeNode([{ filename: 'notes.txt', sizeBytes: 5, kind: 'text' }]),
      {}, ctxBase(),
    );
    expect(result.context).toEqual([{
      role: 'user',
      content: '<file name="notes.txt">\nhello\n</file>',
    }]);
    expect(mockExtractText).toHaveBeenCalledWith(expect.anything(), 'txt');
  });

  it('concatenates multiple text files in declared order', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    mockExtractText.mockResolvedValueOnce('A').mockResolvedValueOnce('B');
    const result = await fileInputNode.run(
      makeNode([
        { filename: 'a.txt', sizeBytes: 1, kind: 'text' },
        { filename: 'b.json', sizeBytes: 1, kind: 'text' },
      ]),
      {}, ctxBase(),
    );
    expect(result.context).toEqual([{
      role: 'user',
      content: '<file name="a.txt">\nA\n</file>\n\n<file name="b.json">\nB\n</file>',
    }]);
  });

  it('emits an image-only multimodal user message when only images are attached', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    const result = await fileInputNode.run(
      makeNode([{ filename: 'a.jpg', sizeBytes: 10, kind: 'image', mime: 'image/jpeg' }]),
      {}, ctxBase(),
    );
    expect(result.context).toEqual([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AQID' } },
      ],
    }]);
  });

  it('emits a mixed multimodal user message when text + image are attached', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    mockExtractText.mockResolvedValue('hello');
    const result = await fileInputNode.run(
      makeNode([
        { filename: 'notes.txt', sizeBytes: 5, kind: 'text' },
        { filename: 'a.png', sizeBytes: 10, kind: 'image', mime: 'image/png' },
      ]),
      {}, ctxBase(),
    );
    const content = (result.context as Array<{ content: unknown }>)[0].content as Array<{ type: string }>;
    expect(content[0]).toEqual({ type: 'text', text: '<file name="notes.txt">\nhello\n</file>' });
    expect(content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AQID' } });
  });

  it('treats entries with no kind as text (backward-compat)', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    mockExtractText.mockResolvedValue('legacy');
    const result = await fileInputNode.run(
      makeNode([{ filename: 'old.txt', sizeBytes: 1 }]),
      {}, ctxBase(),
    );
    const content = (result.context as Array<{ content: unknown }>)[0].content;
    expect(typeof content).toBe('string');
  });

  it('throws if a referenced asset is missing', async () => {
    mockAssetExists.mockResolvedValue(false);
    await expect(
      fileInputNode.run(makeNode([{ filename: 'gone.txt', sizeBytes: 1, kind: 'text' }]), {}, ctxBase()),
    ).rejects.toThrow(/missing asset/);
  });

  it('throws if the graph is unsaved (graphFilePath is null)', async () => {
    const ctx = { ...ctxBase(), graphFilePath: null };
    await expect(
      fileInputNode.run(makeNode([{ filename: 'a.txt', sizeBytes: 1, kind: 'text' }]), {}, ctx),
    ).rejects.toThrow(/save the graph/i);
  });

  it('records empty-extraction warnings in details', async () => {
    mockAssetExists.mockResolvedValue(true);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(0));
    mockExtractText.mockResolvedValue('');
    const ctx = ctxBase();
    await fileInputNode.run(makeNode([{ filename: 'scan.pdf', sizeBytes: 1, kind: 'text' }]), {}, ctx);
    expect(ctx.details.emptyFiles).toEqual(['scan.pdf']);
  });
});
