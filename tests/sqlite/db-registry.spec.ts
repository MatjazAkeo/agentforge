import { describe, it, expect, beforeEach, vi } from 'vitest';

const dispose = vi.fn();
let counter = 0;

vi.mock('@/sqlite/db-host', () => ({
  createDbHost: () => ({ id: ++counter, dispose, init: vi.fn(), query: vi.fn() }),
}));

import { dbRegistry } from '@/sqlite/db-registry';

beforeEach(() => {
  dbRegistry.disposeAll();
  dispose.mockReset();
  counter = 0;
});

describe('dbRegistry', () => {
  it('returns the same host for the same nodeId', () => {
    const a = dbRegistry.getOrCreate('node1');
    const b = dbRegistry.getOrCreate('node1');
    expect(a).toBe(b);
  });

  it('returns different hosts for different nodeIds', () => {
    const a = dbRegistry.getOrCreate('node1');
    const b = dbRegistry.getOrCreate('node2');
    expect(a).not.toBe(b);
  });

  it('disposes the host when dispose(nodeId) is called', () => {
    dbRegistry.getOrCreate('node1');
    dbRegistry.dispose('node1');
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes all hosts on disposeAll()', () => {
    dbRegistry.getOrCreate('a');
    dbRegistry.getOrCreate('b');
    dbRegistry.disposeAll();
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it('get() returns existing or undefined (without creating)', () => {
    expect(dbRegistry.get('nope')).toBeUndefined();
    const created = dbRegistry.getOrCreate('x');
    expect(dbRegistry.get('x')).toBe(created);
  });
});
