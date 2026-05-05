// tests/flavors/sqlite.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const fakeHost = {
  init: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue({ rows: [{ x: 1 }], truncated: false }),
  tables: vi.fn().mockResolvedValue(['users']),
  columns: vi.fn().mockResolvedValue([{ name: 'id', type: 'INTEGER', pk: true, notnull: true }]),
  reload: vi.fn(),
  export: vi.fn(),
  dispose: vi.fn(),
};

const mockReadAssetBytes = vi.fn();

vi.mock('@/sqlite/db-registry', () => ({
  dbRegistry: {
    getOrCreate: vi.fn(() => fakeHost),
  },
}));

vi.mock('@/persistence/assets-dir', () => ({
  readAssetBytes: (...a: unknown[]) => mockReadAssetBytes(...a),
}));

import { sqliteFlavor } from '@/flavors/sqlite';

beforeEach(() => {
  Object.values(fakeHost).forEach((m) => 'mockReset' in m && (m as { mockReset?: () => void }).mockReset?.());
  mockReadAssetBytes.mockReset();
  fakeHost.init.mockResolvedValue(undefined);
  fakeHost.query.mockResolvedValue({ rows: [{ x: 1 }], truncated: false });
  fakeHost.tables.mockResolvedValue(['users']);
  fakeHost.columns.mockResolvedValue([{ name: 'id', type: 'INTEGER', pk: true, notnull: true }]);
});

describe('sqliteFlavor', () => {
  it('exports the correct identity fields', () => {
    expect(sqliteFlavor.type).toBe('sqlite');
    expect(sqliteFlavor.helperName).toBe('sqlite');
  });

  it('default connection has empty db field', () => {
    expect(sqliteFlavor.defaultConnection).toEqual({ db: '', sourcePath: undefined, sizeBytes: 0 });
  });

  it('buildHelper initializes the host with bytes from the asset', async () => {
    fakeHost.init.mockResolvedValue(undefined);
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(16));
    const helper = await sqliteFlavor.buildHelper(
      { db: 'users.db', sizeBytes: 16 },
      'node1',
      '/u/m/proj.graph.json',
    );
    expect(mockReadAssetBytes).toHaveBeenCalledWith('/u/m/proj.graph.json', 'users.db');
    expect(fakeHost.init).toHaveBeenCalledTimes(1);
    expect(typeof helper.query).toBe('function');
    expect(typeof helper.tables).toBe('function');
    expect(typeof helper.columns).toBe('function');
  });

  it('helper.query forwards to the host', async () => {
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(8));
    const helper = await sqliteFlavor.buildHelper({ db: 'x.db', sizeBytes: 8 }, 'n', '/u/m/g.graph.json');
    const res = await helper.query('SELECT 1', { a: 1 });
    expect(fakeHost.query).toHaveBeenCalledWith('SELECT 1', { a: 1 }, 1000);
    expect(res).toEqual({ rows: [{ x: 1 }], truncated: false });
  });

  it('helper.query forwards a per-tool maxRows override', async () => {
    mockReadAssetBytes.mockResolvedValue(new ArrayBuffer(8));
    const helper = await sqliteFlavor.buildHelper({ db: 'x.db', sizeBytes: 8 }, 'n', '/u/m/g.graph.json', 250);
    await helper.query('SELECT 1');
    expect(fakeHost.query).toHaveBeenCalledWith('SELECT 1', undefined, 250);
  });

  it('throws if the graph is unsaved (no graphFilePath)', async () => {
    await expect(
      sqliteFlavor.buildHelper({ db: 'x.db', sizeBytes: 8 }, 'n', null),
    ).rejects.toThrow(/save the graph/i);
  });
});
