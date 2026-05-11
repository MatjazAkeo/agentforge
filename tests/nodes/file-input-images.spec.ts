import { describe, it, expect, vi } from 'vitest';

vi.mock('@/persistence/assets-dir', () => ({
  readAssetBytes: vi.fn(async () => new Uint8Array([])),
  assetExists: vi.fn(async () => true),
}));

vi.mock('@/files/extract', async () => {
  const real = await vi.importActual<typeof import('@/files/extract')>('@/files/extract');
  return { ...real, extractText: vi.fn(async () => 'extracted text content') };
});

import { fileInputNode } from '@/nodes/file-input';
import type { Node } from '@/domain/graph';

const ctxBase = () => ({
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
  graphFilePath: '/u/m/proj.graph.json',
});

function makeNode(files: Array<{ filename: string; sizeBytes: number; kind?: 'text' | 'image'; mime?: string }>): Node {
  return {
    id: 'fi', type: 'file-input', position: { x: 0, y: 0 },
    config: { files },
  };
}

describe('file-input node — image outputs', () => {
  it('emits `images` (asset refs) when image files are attached', async () => {
    const node = makeNode([{ filename: 'a.jpg', sizeBytes: 1, kind: 'image', mime: 'image/jpeg' }]);
    const result = await fileInputNode.run(node, {}, ctxBase());
    expect(result.images).toEqual([
      { kind: 'asset', filename: 'a.jpg', mime: 'image/jpeg' },
    ]);
  });

  it('does NOT emit `images` when only text files are attached', async () => {
    const node = makeNode([{ filename: 't.txt', sizeBytes: 1, kind: 'text' }]);
    const result = await fileInputNode.run(node, {}, ctxBase());
    expect(result.images).toBeUndefined();
    expect(typeof result.text).toBe('string');
  });

  it('emits both `text` and `images` for mixed attachments', async () => {
    const node = makeNode([
      { filename: 't.txt', sizeBytes: 1, kind: 'text' },
      { filename: 'a.png', sizeBytes: 1, kind: 'image', mime: 'image/png' },
    ]);
    const result = await fileInputNode.run(node, {}, ctxBase());
    expect(typeof result.text).toBe('string');
    expect(result.images).toEqual([
      { kind: 'asset', filename: 'a.png', mime: 'image/png' },
    ]);
  });

  it('omits `text` when only images are attached', async () => {
    const node = makeNode([{ filename: 'a.webp', sizeBytes: 1, kind: 'image', mime: 'image/webp' }]);
    const result = await fileInputNode.run(node, {}, ctxBase());
    expect(result.text).toBeUndefined();
    expect(result.images).toHaveLength(1);
  });

  it('treats entries with no kind as text (backward-compat)', async () => {
    const node = makeNode([{ filename: 'legacy.txt', sizeBytes: 1 }]);
    const result = await fileInputNode.run(node, {}, ctxBase());
    expect(typeof result.text).toBe('string');
    expect(result.images).toBeUndefined();
  });
});
