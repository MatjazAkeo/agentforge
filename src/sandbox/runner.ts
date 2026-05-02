// src/sandbox/runner.ts
export interface RunInSandboxArgs {
  code: string;
  inputs: Record<string, unknown>;
  timeoutMs: number;
  signal: AbortSignal;
}

export type SandboxResult =
  | { kind: 'ok'; value: unknown; logs: unknown[][]; durationMs: number }
  | { kind: 'error'; message: string; stack?: string; logs: unknown[][]; durationMs: number };

export async function runInSandbox(args: RunInSandboxArgs): Promise<SandboxResult> {
  const t0 = performance.now();
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const logs: unknown[][] = [];

  return new Promise<SandboxResult>((resolve) => {
    let settled = false;
    const settle = (r: SandboxResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      worker.terminate();
      args.signal.removeEventListener('abort', onAbort);
      resolve(r);
    };

    const timeoutId = setTimeout(() => {
      settle({
        kind: 'error',
        message: `timeout after ${args.timeoutMs}ms`,
        logs,
        durationMs: performance.now() - t0,
      });
    }, args.timeoutMs);

    const onAbort = () => {
      settle({ kind: 'error', message: 'aborted', logs, durationMs: performance.now() - t0 });
    };
    args.signal.addEventListener('abort', onAbort);

    worker.onmessage = (e) => {
      const msg = e.data as { type: string; [k: string]: unknown };
      if (msg.type === 'log') {
        logs.push(msg.args as unknown[]);
        return;
      }
      if (msg.type === 'ok') {
        settle({ kind: 'ok', value: msg.value, logs, durationMs: performance.now() - t0 });
      } else if (msg.type === 'error') {
        settle({
          kind: 'error',
          message: String(msg.message),
          stack: msg.stack as string | undefined,
          logs,
          durationMs: performance.now() - t0,
        });
      }
    };

    worker.onerror = (e) => {
      settle({
        kind: 'error',
        message: e.message || 'worker error',
        logs,
        durationMs: performance.now() - t0,
      });
    };

    worker.postMessage({ code: args.code, inputs: args.inputs });
  });
}
