// @vitest-environment jsdom
import '../setup/worker-polyfill';
import { describe, it, expect } from 'vitest';
import { runInSandbox } from '@/sandbox/runner';

describe('runInSandbox with helpers', () => {
  it('routes helper-call messages to the provided helper impl', async () => {
    const helpers = {
      sqlite: {
        query: async (sql: unknown, params: unknown) => ({ rows: [{ sql, params }], truncated: false }),
      },
    };
    const result = await runInSandbox({
      code: `
        const out = await sqlite.query('SELECT 1', { x: 2 });
        return out.rows[0];
      `,
      inputs: {},
      timeoutMs: 5000,
      signal: new AbortController().signal,
      helpers,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value).toEqual({ sql: 'SELECT 1', params: { x: 2 } });
    }
  });

  it('surfaces helper-impl errors as exceptions in user code', async () => {
    const helpers = {
      sqlite: {
        query: async () => { throw new Error('table missing'); },
      },
    };
    const result = await runInSandbox({
      code: `
        try { await sqlite.query('x'); return 'no-throw'; }
        catch (e) { return 'caught: ' + e.message; }
      `,
      inputs: {},
      timeoutMs: 5000,
      signal: new AbortController().signal,
      helpers,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value).toBe('caught: table missing');
  });

  it('still works with no helpers (back-compat)', async () => {
    const result = await runInSandbox({
      code: `return inputs.a + inputs.b;`,
      inputs: { a: 2, b: 3 },
      timeoutMs: 5000,
      signal: new AbortController().signal,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value).toBe(5);
  });
});
