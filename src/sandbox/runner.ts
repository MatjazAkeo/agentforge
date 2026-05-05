// src/sandbox/runner.ts
export interface SandboxHelpers {
  /** Map from helper name (e.g. 'sqlite') to an object whose methods are async
   *  functions invoked from inside the user code. The runner routes worker
   *  messages of shape { type:'helper-call', helper, method, args, callId }
   *  to the matching method on this object. */
  [helperName: string]: { [methodName: string]: (...args: unknown[]) => Promise<unknown> };
}

export interface RunInSandboxArgs {
  code: string;
  inputs: Record<string, unknown>;
  timeoutMs: number;
  signal: AbortSignal;
  /** Optional helpers exposed to the user code. Names become positional args
   *  in the function wrapping the body, so the code can write
   *  `await sqlite.query(...)`. */
  helpers?: SandboxHelpers;
}

export type SandboxResult =
  | { kind: 'ok'; value: unknown; logs: unknown[][]; durationMs: number }
  | { kind: 'error'; message: string; stack?: string; logs: unknown[][]; durationMs: number };

export async function runInSandbox(args: RunInSandboxArgs): Promise<SandboxResult> {
  const t0 = performance.now();
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const logs: unknown[][] = [];
  const helpers = args.helpers ?? {};
  const helperNames = Object.keys(helpers);

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

    worker.onmessage = async (e) => {
      const msg = e.data as { type: string; [k: string]: unknown };
      if (msg.type === 'log') {
        logs.push(msg.args as unknown[]);
        return;
      }
      if (msg.type === 'helper-call') {
        const { callId, helper, method, args: callArgs } = msg as unknown as {
          callId: number;
          helper: string;
          method: string;
          args: unknown[];
        };
        const impl = helpers[helper]?.[method];
        if (!impl) {
          worker.postMessage({
            type: 'helper-result',
            callId,
            ok: false,
            error: `unknown helper ${helper}.${method}`,
          });
          return;
        }
        try {
          const value = await impl(...callArgs);
          worker.postMessage({ type: 'helper-result', callId, ok: true, value });
        } catch (err) {
          worker.postMessage({
            type: 'helper-result',
            callId,
            ok: false,
            error: (err as Error).message,
          });
        }
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

    worker.postMessage({
      type: 'run',
      code: args.code,
      inputs: args.inputs,
      helperNames,
    });
  });
}
