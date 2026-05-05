import { describe, it, expect, vi, beforeEach } from 'vitest';

const { FakeWorker } = vi.hoisted(() => {
  class FakeWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    posted: unknown[] = [];
    postMessage(msg: unknown) {
      this.posted.push(msg);
      queueMicrotask(() => {
        const m = msg as { id: number; op: string };
        const value = m.op === 'tables' ? ['users']
          : m.op === 'columns' ? [{ name: 'id', type: 'INTEGER', pk: true, notnull: true }]
          : m.op === 'query' ? { rows: [{ a: 1 }], truncated: false }
          : m.op === 'export' ? new ArrayBuffer(8)
          : null;
        this.onmessage?.({ data: { id: m.id, ok: true, value } } as MessageEvent);
      });
    }
    terminate() { /* no-op */ }
  }
  return { FakeWorker };
});

vi.mock('@/sqlite/db-worker?worker', () => ({ default: FakeWorker }));

import { createDbHost } from '@/sqlite/db-host';

beforeEach(() => { /* nothing */ });

describe('DbHost', () => {
  it('resolves init with the loaded bytes', async () => {
    const host = createDbHost();
    await host.init(new ArrayBuffer(16));
    expect(host.posted()[0]).toMatchObject({ op: 'init' });
  });

  it('queries return shaped result', async () => {
    const host = createDbHost();
    await host.init(new ArrayBuffer(8));
    const r = await host.query('SELECT 1');
    expect(r.rows).toEqual([{ a: 1 }]);
    expect(r.truncated).toBe(false);
  });

  it('tables() returns a string array', async () => {
    const host = createDbHost();
    await host.init(new ArrayBuffer(8));
    expect(await host.tables()).toEqual(['users']);
  });

  it('columns() returns column info', async () => {
    const host = createDbHost();
    await host.init(new ArrayBuffer(8));
    const cols = await host.columns('users');
    expect(cols[0]).toMatchObject({ name: 'id', pk: true });
  });

  it('export() returns an ArrayBuffer', async () => {
    const host = createDbHost();
    await host.init(new ArrayBuffer(8));
    const out = await host.export();
    expect(out).toBeInstanceOf(ArrayBuffer);
  });

  it('correlates concurrent requests by id', async () => {
    const host = createDbHost();
    await host.init(new ArrayBuffer(8));
    const [a, b, c] = await Promise.all([host.tables(), host.tables(), host.tables()]);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('rejects if a response carries an error', async () => {
    const ErrWorker = class extends FakeWorker {
      postMessage(msg: unknown) {
        queueMicrotask(() => {
          this.onmessage?.({ data: { id: (msg as { id: number }).id, ok: false, error: 'boom' } } as MessageEvent);
        });
      }
    };
    vi.doMock('@/sqlite/db-worker?worker', () => ({ default: ErrWorker }));
    vi.resetModules();
    const { createDbHost: createDbHost2 } = await import('@/sqlite/db-host');
    const host = createDbHost2();
    await expect(host.tables()).rejects.toThrow(/boom/);
  });
});
