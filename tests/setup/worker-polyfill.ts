// Test-only Worker polyfill backed by Node's worker_threads.
// jsdom/happy-dom don't implement the Web Worker API; vitest tests still
// need to run our `src/sandbox/worker.ts` module-equivalent in a real
// thread so that timeouts, postMessage, and `while(true){}` semantics behave
// like in the browser.
//
// Strategy: when Worker is missing, we install a shim that ignores the
// passed URL and instead spins up a Node worker_threads.Worker running
// an inlined JS port of `src/sandbox/worker.ts`. The two implementations
// must stay in sync (the inline source is the canonical worker logic
// translated from TS to JS — see comment block below).

import { Worker as NodeWorker } from 'node:worker_threads';

// Keep this in sync with src/sandbox/worker.ts. Same logic, plain JS, using
// parentPort instead of self.
const WORKER_SOURCE = `
const { parentPort } = require('node:worker_threads');

let nextCallId = 1;
const pending = new Map();

function callHelper(helper, method, args) {
  const callId = nextCallId++;
  return new Promise((resolve, reject) => {
    pending.set(callId, { resolve, reject });
    parentPort.postMessage({ type: 'helper-call', callId, helper, method, args });
  });
}

function makeHelperProxy(name) {
  return new Proxy({}, {
    get(_t, method) {
      return (...args) => callHelper(name, method, args);
    },
  });
}

parentPort.on('message', async (msg) => {
  if (msg && msg.type === 'helper-result') {
    const p = pending.get(msg.callId);
    if (!p) return;
    pending.delete(msg.callId);
    if (msg.ok) p.resolve(msg.value);
    else p.reject(new Error(msg.error || 'helper call failed'));
    return;
  }

  // type === 'run'
  const { code, inputs, helperNames } = msg;
  const names = Array.isArray(helperNames) ? helperNames : [];

  const helpers = {
    log: (...args) => parentPort.postMessage({ type: 'log', args }),
    fetch: (url, init) => fetch(url, init),
  };

  const helperProxies = names.map(makeHelperProxy);

  try {
    const fn = new Function(
      'inputs',
      'helpers',
      ...names,
      'return (async () => { ' + code + ' })();'
    );
    const value = await fn(inputs, helpers, ...helperProxies);
    parentPort.postMessage({ type: 'ok', value });
  } catch (err) {
    parentPort.postMessage({ type: 'error', message: err.message, stack: err.stack });
  }
});
`;

class WorkerShim {
  private nodeWorker: NodeWorker;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message: string }) => void) | null = null;

  constructor(_url: string | URL, _options?: WorkerOptions) {
    this.nodeWorker = new NodeWorker(WORKER_SOURCE, { eval: true });
    this.nodeWorker.on('message', (data) => {
      this.onmessage?.({ data });
    });
    this.nodeWorker.on('error', (err: Error) => {
      this.onerror?.({ message: err.message });
    });
  }

  postMessage(data: unknown): void {
    this.nodeWorker.postMessage(data);
  }

  terminate(): void {
    void this.nodeWorker.terminate();
  }

  addEventListener(): void {
    /* not used by runner */
  }
  removeEventListener(): void {
    /* not used by runner */
  }
  dispatchEvent(): boolean {
    return false;
  }
}

if (typeof (globalThis as { Worker?: unknown }).Worker === 'undefined') {
  (globalThis as { Worker: unknown }).Worker = WorkerShim;
}
