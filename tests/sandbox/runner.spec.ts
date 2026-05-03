// @vitest-environment jsdom
import '../setup/worker-polyfill';
import { describe, it, expect } from 'vitest';
import { runInSandbox } from '@/sandbox/runner';

describe('sandbox runner', () => {
  it('runs simple synchronous code and returns the value', async () => {
    const result = await runInSandbox({
      code: 'return inputs.a + inputs.b;',
      inputs: { a: 2, b: 3 },
      timeoutMs: 1000,
      signal: new AbortController().signal,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value).toBe(5);
  });

  it('returns error on thrown exception', async () => {
    const result = await runInSandbox({
      code: 'throw new Error("boom");',
      inputs: {},
      timeoutMs: 1000,
      signal: new AbortController().signal,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/boom/);
  });

  it('returns error on timeout', async () => {
    const result = await runInSandbox({
      code: 'while(true){}',
      inputs: {},
      timeoutMs: 50,
      signal: new AbortController().signal,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/timeout/i);
  });

  it('captures helpers.log output', async () => {
    const result = await runInSandbox({
      code: 'helpers.log("hello", 42); return null;',
      inputs: {},
      timeoutMs: 1000,
      signal: new AbortController().signal,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.logs).toEqual([['hello', 42]]);
    }
  });
});
