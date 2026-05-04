import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExists = vi.fn();
const mockMkdir = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockRemove = vi.fn();
const mockReadDir = vi.fn();

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: (...a: unknown[]) => mockExists(...a),
  mkdir: (...a: unknown[]) => mockMkdir(...a),
  readFile: (...a: unknown[]) => mockReadFile(...a),
  writeFile: (...a: unknown[]) => mockWriteFile(...a),
  remove: (...a: unknown[]) => mockRemove(...a),
  readDir: (...a: unknown[]) => mockReadDir(...a),
}));

import {
  assetsDirFor, ensureAssetsDir, copyToAssets,
  readAssetBytes, assetExists, removeAsset,
} from '@/persistence/assets-dir';

beforeEach(() => {
  [mockExists, mockMkdir, mockReadFile, mockWriteFile, mockRemove, mockReadDir].forEach((m) => m.mockReset());
});

describe('assetsDirFor', () => {
  it('strips .graph.json and appends .assets', () => {
    expect(assetsDirFor('/u/m/graphs/proj.graph.json')).toBe('/u/m/graphs/proj.assets');
  });

  it('handles paths with dots in directory names', () => {
    expect(assetsDirFor('/u/m.with.dots/proj.graph.json')).toBe('/u/m.with.dots/proj.assets');
  });

  it('handles non-graph.json suffix gracefully', () => {
    expect(assetsDirFor('/u/m/proj.json')).toBe('/u/m/proj.assets');
  });
});

describe('ensureAssetsDir', () => {
  it('creates the dir if it does not exist', async () => {
    mockExists.mockResolvedValue(false);
    await ensureAssetsDir('/u/m/proj.graph.json');
    expect(mockMkdir).toHaveBeenCalledWith('/u/m/proj.assets', { recursive: true });
  });

  it('skips mkdir if it already exists', async () => {
    mockExists.mockResolvedValue(true);
    await ensureAssetsDir('/u/m/proj.graph.json');
    expect(mockMkdir).not.toHaveBeenCalled();
  });
});

describe('copyToAssets', () => {
  it('writes the bytes to <dir>/<basename> when no collision', async () => {
    mockExists.mockImplementation((p: string) =>
      Promise.resolve(p === '/u/m/proj.assets'),
    );
    mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const out = await copyToAssets('/u/m/proj.graph.json', '/source/notes.txt');
    expect(out).toBe('notes.txt');
    expect(mockWriteFile).toHaveBeenCalledWith('/u/m/proj.assets/notes.txt', new Uint8Array([1, 2, 3]));
  });

  it('appends -2 on collision', async () => {
    mockExists.mockImplementation((p: string) => {
      if (p === '/u/m/proj.assets') return Promise.resolve(true);
      if (p === '/u/m/proj.assets/notes.txt') return Promise.resolve(true);
      return Promise.resolve(false);
    });
    mockReadFile.mockResolvedValue(new Uint8Array([9]));
    const out = await copyToAssets('/u/m/proj.graph.json', '/source/notes.txt');
    expect(out).toBe('notes-2.txt');
  });

  it('appends -3 on cascading collision', async () => {
    mockExists.mockImplementation((p: string) => {
      if (p.endsWith('proj.assets')) return Promise.resolve(true);
      if (p.endsWith('notes.txt')) return Promise.resolve(true);
      if (p.endsWith('notes-2.txt')) return Promise.resolve(true);
      return Promise.resolve(false);
    });
    mockReadFile.mockResolvedValue(new Uint8Array([0]));
    const out = await copyToAssets('/u/m/proj.graph.json', '/source/notes.txt');
    expect(out).toBe('notes-3.txt');
  });

  it('preserves the extension when adding a suffix', async () => {
    mockExists.mockImplementation((p: string) => {
      if (p.endsWith('.assets')) return Promise.resolve(true);
      if (p.endsWith('spec.pdf')) return Promise.resolve(true);
      return Promise.resolve(false);
    });
    mockReadFile.mockResolvedValue(new Uint8Array([0]));
    const out = await copyToAssets('/u/m/proj.graph.json', '/source/spec.pdf');
    expect(out).toBe('spec-2.pdf');
  });
});

describe('readAssetBytes', () => {
  it('reads <dir>/<filename> and returns ArrayBuffer', async () => {
    const u8 = new Uint8Array([7, 8, 9]);
    mockReadFile.mockResolvedValue(u8);
    const out = await readAssetBytes('/u/m/proj.graph.json', 'notes.txt');
    expect(mockReadFile).toHaveBeenCalledWith('/u/m/proj.assets/notes.txt');
    expect(new Uint8Array(out)).toEqual(u8);
  });
});

describe('assetExists', () => {
  it('checks the file inside the assets dir', async () => {
    mockExists.mockResolvedValue(true);
    const out = await assetExists('/u/m/proj.graph.json', 'notes.txt');
    expect(mockExists).toHaveBeenCalledWith('/u/m/proj.assets/notes.txt');
    expect(out).toBe(true);
  });
});

describe('removeAsset', () => {
  it('removes the file inside the assets dir', async () => {
    await removeAsset('/u/m/proj.graph.json', 'notes.txt');
    expect(mockRemove).toHaveBeenCalledWith('/u/m/proj.assets/notes.txt');
  });
});
