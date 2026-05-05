import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteFile = vi.fn();
const mockRename = vi.fn();
const mockRemove = vi.fn();
const mockExists = vi.fn();

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: (...a: unknown[]) => mockWriteFile(...a),
  rename: (...a: unknown[]) => mockRename(...a),
  remove: (...a: unknown[]) => mockRemove(...a),
  exists: (...a: unknown[]) => mockExists(...a),
}));

import { writeFileAtomic } from '@/persistence/atomic-write';

beforeEach(() => {
  [mockWriteFile, mockRename, mockRemove, mockExists].forEach((m) => m.mockReset());
});

describe('writeFileAtomic', () => {
  it('writes to .tmp then renames', async () => {
    mockExists.mockResolvedValue(false);
    await writeFileAtomic('/u/m/db.sqlite', new Uint8Array([1, 2, 3]));
    expect(mockWriteFile).toHaveBeenCalledWith('/u/m/db.sqlite.tmp', new Uint8Array([1, 2, 3]));
    expect(mockRename).toHaveBeenCalledWith('/u/m/db.sqlite.tmp', '/u/m/db.sqlite');
  });

  it('cleans up the .tmp file if write succeeds but rename fails', async () => {
    mockExists.mockImplementation(async (p: string) => p.endsWith('.tmp'));
    mockRename.mockRejectedValue(new Error('rename failed'));
    await expect(writeFileAtomic('/u/m/db.sqlite', new Uint8Array([1])))
      .rejects.toThrow(/rename failed/);
    expect(mockRemove).toHaveBeenCalledWith('/u/m/db.sqlite.tmp');
  });
});
