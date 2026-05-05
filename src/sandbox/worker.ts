// src/sandbox/worker.ts
//
// Runs inside a Web Worker. No DOM. fetch() is global. Has no access to the
// main app except via "helpers" — proxy objects whose method calls round-trip
// to the main thread and back.

interface RunMessage {
  type: 'run';
  code: string;
  inputs: Record<string, unknown>;
  /** Names of helpers to expose. Each becomes a proxy object available to the
   *  user code as a positional argument to the wrapping function. */
  helperNames: string[];
}

interface HelperResultMessage {
  type: 'helper-result';
  callId: number;
  ok: boolean;
  value?: unknown;
  error?: string;
}

let nextCallId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function callHelper(helper: string, method: string, args: unknown[]): Promise<unknown> {
  const callId = nextCallId++;
  return new Promise((resolve, reject) => {
    pending.set(callId, { resolve, reject });
    self.postMessage({ type: 'helper-call', callId, helper, method, args });
  });
}

function makeHelperProxy(name: string): unknown {
  return new Proxy({}, {
    get(_t, method: string) {
      return (...args: unknown[]) => callHelper(name, method, args);
    },
  });
}

self.onmessage = async (e: MessageEvent<RunMessage | HelperResultMessage>) => {
  const msg = e.data;
  if (msg.type === 'helper-result') {
    const p = pending.get(msg.callId);
    if (!p) return;
    pending.delete(msg.callId);
    if (msg.ok) p.resolve(msg.value);
    else p.reject(new Error(msg.error ?? 'helper call failed'));
    return;
  }

  // type === 'run'
  const { code, inputs, helperNames } = msg;
  const helpers = {
    log: (...args: unknown[]) => self.postMessage({ type: 'log', args }),
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
  };

  const helperProxies = helperNames.map(makeHelperProxy);

  try {
    const fn = new Function(
      'inputs',
      'helpers',
      ...helperNames,
      `return (async () => { ${code} })();`,
    );
    const value = await fn(inputs, helpers, ...helperProxies);
    self.postMessage({ type: 'ok', value });
  } catch (err) {
    const e = err as Error;
    self.postMessage({ type: 'error', message: e.message, stack: e.stack });
  }
};
