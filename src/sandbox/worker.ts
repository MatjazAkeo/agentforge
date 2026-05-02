// src/sandbox/worker.ts
// Runs inside a Web Worker. No DOM. Has fetch() globally. No access to the main app.

self.onmessage = async (e: MessageEvent<{ code: string; inputs: Record<string, unknown> }>) => {
  const { code, inputs } = e.data;

  const helpers = {
    log: (...args: unknown[]) => self.postMessage({ type: 'log', args }),
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
  };

  try {
    const fn = new Function('inputs', 'helpers', `return (async () => { ${code} })();`);
    const value = await fn(inputs, helpers);
    self.postMessage({ type: 'ok', value });
  } catch (err) {
    const e = err as Error;
    self.postMessage({ type: 'error', message: e.message, stack: e.stack });
  }
};
