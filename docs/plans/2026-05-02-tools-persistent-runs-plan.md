# AI Agent Playground — Plan 2: Tools & Persistent Runs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tool-calling capability and persistent run history. End state: you can wire a `Tool` node (custom JS) into an `LLM Call` via a `Tool Group`, the LLM emits `toolCalls`, a `Tool Runner` executes them in a sandboxed Web Worker, results feed back to a follow-up LLM call, the entire run gets saved as a JSON file alongside the graph, and the Runs tab shows past runs with rich-preview rows you can click to inspect.

**Architecture:** New node types (`tool`, `tool-group`, `tool-runner`) plus a Web Worker sandbox at `src/sandbox/`. Monaco editor lazy-loaded inside the Tool node's inspector. Trust-prompt modal gates execution of user code coming from shared graphs. Run records gain `IterationRecord`-friendly per-node detail and are persisted to `<graph>.runs/<timestamp>.run.json` after each run.

**Tech additions:** Monaco editor (already installed in Plan 1), `@tauri-apps/plugin-fs` for the runs folder (already wired), no new npm packages required for the sandbox (vanilla `Worker` + `postMessage`).

**Reference docs:** Design spec at `docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md` — sections 6.4–6.6 (Tool / Tool Group / Tool Runner), 9 (Run model & persistence), 11 (Sandbox), 14 (Security), and 19 phasing items 3-4.

---

## File Structure (additions)

```
src/
├── domain/
│   └── node-types.ts                # extend: ToolConfig, ToolGroupConfig, ToolRunnerConfig
│
├── nodes/
│   ├── tool.ts                      # Tool node definition + run() (no-op — definitions, not executors)
│   ├── tool-group.ts                # Tool Group node — aggregates connected tool defs
│   ├── tool-runner.ts               # Tool Runner — receives toolCalls, runs each tool in a Worker
│   └── port-types.ts                # extend with tool-group and tool-runner port types
│
├── sandbox/
│   ├── worker.ts                    # Web Worker entry — receives {code, inputs}, runs, posts back
│   ├── helpers.ts                   # fetch / tauriCommand / log helpers exposed inside the worker
│   ├── runner.ts                    # main-thread side: spawnWorker(), call(), terminate()
│   └── trust.ts                     # asks the user to confirm running custom code in shared graphs
│
├── persistence/
│   ├── run-io.ts                    # serializeRun, parseRun, runFilePath helpers
│   └── runs-dir.ts                  # list/load/delete files in <graph>.runs/
│
├── components/
│   ├── nodes/
│   │   ├── ToolNode.vue
│   │   ├── ToolGroupNode.vue
│   │   └── ToolRunnerNode.vue
│   ├── inspectors/
│   │   ├── ToolInspector.vue        # name, description, JSON schema, Monaco code editor
│   │   ├── ToolGroupInspector.vue   # read-only members list, conflict warnings
│   │   └── ToolRunnerInspector.vue  # per-tool-call detail rows
│   ├── runs/
│   │   ├── RunsList.vue             # rich-preview rows in the Runs tab
│   │   └── RunRow.vue               # single row component
│   ├── MonacoEditor.vue             # lazy-loaded wrapper around monaco-editor
│   └── TrustPromptModal.vue         # "this graph contains custom code — run anyway?"
│
├── stores/
│   ├── runs.ts                      # NEW — list of saved runs for the open graph + active loaded run
│   └── ui.ts                        # extend: trustPromptOpen, pendingTrustResolution
│
├── openrouter/
│   ├── client.ts                    # extend: pass tools array, parse tool_calls from responses
│   └── types.ts                     # tool-call types already exist; verify
│
├── nodes/
│   └── llm-call.ts                  # extend: include connected tools in request, parse toolCalls

tests/
├── nodes/tool-runner.spec.ts
├── sandbox/runner.spec.ts
├── persistence/run-io.spec.ts
└── openrouter/tool-calls.spec.ts
```

**File-size guideline:** keep under ~300 lines. The Tool Runner is the largest single file (worker dispatch + result aggregation); split if it grows unwieldy.

---

## Task 1: Domain types for tool nodes

**Files:**
- Modify: `src/domain/node-types.ts`

- [ ] **Step 1: Extend node-types.ts with Tool / ToolGroup / ToolRunner config interfaces**

```ts
export interface ToolConfig {
  name: string;                                    // snake_case identifier exposed to the LLM
  description: string;                             // prompt-visible description
  inputSchema: Record<string, unknown>;            // JSON Schema for the tool's `inputs` arg
  code: string;                                    // user-authored JS function body
  timeoutMs: number;                               // per-invocation safety cap
}

export interface ToolGroupConfig {
  label: string;                                   // shown on the node card; cosmetic only
}

export interface ToolRunnerConfig {
  // No config — behavior fully driven by inputs.
}
```

Update `NodeConfig` union:

```ts
export type NodeConfig =
  | InputConfig
  | OutputConfig
  | LLMCallConfig
  | ToolConfig
  | ToolGroupConfig
  | ToolRunnerConfig
  | Record<string, unknown>;
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(domain): Tool / ToolGroup / ToolRunner config types"
```

---

## Task 2: Extend port-types for the new nodes

**Files:**
- Modify: `src/nodes/port-types.ts`

- [ ] **Step 1: Add tool-group + tool-runner port type rules**

```ts
export function getSourcePortType(node: Node, handleId: string): DataType | null {
  switch (node.type) {
    case 'input': /* unchanged */
    case 'llm-call': /* unchanged */
    case 'tool':
      if (handleId === 'toolDefinition') return 'tools';
      return null;
    case 'tool-group':
      if (handleId === 'toolDefinition') return 'tools';
      return null;
    case 'tool-runner':
      if (handleId === 'messages') return 'messages';
      if (handleId === 'results') return 'json';   // tool result records, exposed for inspection
      return null;
    default: return null;
  }
}

export function getTargetPortType(node: Node, handleId: string): DataType | null {
  switch (node.type) {
    case 'output': /* unchanged */
    case 'llm-call': /* unchanged — tools target stays */
    case 'tool-group':
      if (handleId.startsWith('tools-')) return 'tools';   // multi-edge fan-in
      return null;
    case 'tool-runner':
      if (handleId === 'toolCalls') return 'tool-calls';
      if (handleId === 'tools') return 'tools';
      if (handleId === 'messages') return 'messages';
      return null;
    default: return null;
  }
}
```

Note `'tool-calls'` is a new wire type — distinct from `'tools'` (the latter is tool *definitions*, the former is *invocations* the LLM emits). Add it to `DataType` and `TYPE_COLORS`:

```ts
export type DataType = 'string' | 'messages' | 'tools' | 'tool-calls' | 'json';

const TYPE_COLORS: Record<DataType, string> = {
  string: '#ffaa55',
  messages: '#b388ff',
  tools: '#ffd54a',
  'tool-calls': '#ff5577',
  json: '#4ad7e2',
};
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ports): tool-group / tool-runner port types + tool-calls wire type"
```

---

## Task 3: Web Worker sandbox — runner side (main thread)

**Files:**
- Create: `src/sandbox/runner.ts`
- Test: `tests/sandbox/runner.spec.ts`

- [ ] **Step 1: Write the failing test**

`tests/sandbox/runner.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run, verify fails**

```bash
npm run test:run -- tests/sandbox/runner.spec.ts
```

Expected: FAIL — "Cannot find module '@/sandbox/runner'".

- [ ] **Step 3: Create src/sandbox/runner.ts**

```ts
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
    const cleanup = () => {
      clearTimeout(timeoutId);
      worker.terminate();
      args.signal.removeEventListener('abort', onAbort);
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve({ kind: 'error', message: `timeout after ${args.timeoutMs}ms`, logs, durationMs: performance.now() - t0 });
    }, args.timeoutMs);

    const onAbort = () => {
      cleanup();
      resolve({ kind: 'error', message: 'aborted', logs, durationMs: performance.now() - t0 });
    };
    args.signal.addEventListener('abort', onAbort);

    worker.onmessage = (e) => {
      const msg = e.data as { type: string; [k: string]: unknown };
      if (msg.type === 'log') {
        logs.push(msg.args as unknown[]);
        return;
      }
      if (msg.type === 'ok') {
        cleanup();
        resolve({ kind: 'ok', value: msg.value, logs, durationMs: performance.now() - t0 });
      } else if (msg.type === 'error') {
        cleanup();
        resolve({
          kind: 'error',
          message: String(msg.message),
          stack: msg.stack as string | undefined,
          logs,
          durationMs: performance.now() - t0,
        });
      }
    };

    worker.onerror = (e) => {
      cleanup();
      resolve({ kind: 'error', message: e.message || 'worker error', logs, durationMs: performance.now() - t0 });
    };

    worker.postMessage({ code: args.code, inputs: args.inputs });
  });
}
```

- [ ] **Step 4: Create src/sandbox/worker.ts (the Worker entrypoint)**

```ts
// src/sandbox/worker.ts
// Runs inside a Web Worker. No DOM. Has fetch() globally. No access to the main app.

self.onmessage = async (e: MessageEvent<{ code: string; inputs: Record<string, unknown> }>) => {
  const { code, inputs } = e.data;

  const helpers = {
    log: (...args: unknown[]) => self.postMessage({ type: 'log', args }),
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
    // tauriCommand intentionally left out for v1 — Plan 2's threat model rejects FS escalation.
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
```

- [ ] **Step 5: Verify tests pass**

```bash
npm run test:run -- tests/sandbox/runner.spec.ts
```

Expected: 4/4.

**Caveat:** Web Workers in `happy-dom` (the test environment) may not work fully. If they don't, the test setup needs to switch to `jsdom` or use a Worker shim. Try happy-dom first; if `new Worker` is undefined, switch the per-file environment via `// @vitest-environment jsdom` comment at the top of the spec file and add `jsdom` to devDependencies.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(sandbox): Web Worker runner for tool code, with timeout/abort/log capture"
```

---

## Task 4: Tool node definition

**Files:**
- Create: `src/nodes/tool.ts`

- [ ] **Step 1: Create src/nodes/tool.ts**

The Tool node has no `run()` work — it's a definition that downstream Tool Runner reads. Its `run()` simply exposes the config so the runner can find it via the wire.

```ts
// src/nodes/tool.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolConfig } from '@/domain/node-types';

export interface ToolDefinitionPayload {
  toolId: string;          // Node id — used by Tool Runner to look up the source code
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  code: string;
  timeoutMs: number;
}

export const toolNode: NodeDefinition = {
  type: 'tool',
  inputPorts: [],
  outputPorts: ['toolDefinition'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as ToolConfig;
    const payload: ToolDefinitionPayload = {
      toolId: node.id,
      name: cfg.name,
      description: cfg.description,
      inputSchema: cfg.inputSchema,
      code: cfg.code,
      timeoutMs: cfg.timeoutMs ?? 30_000,
    };
    ctx.details.definition = payload;
    return { toolDefinition: [payload] };  // single-element array so Tool Group can flatten cleanly
  },
};

registerNodeDefinition(toolNode);
```

- [ ] **Step 2: Add to main.ts eager imports**

Edit `src/main.ts`:

```ts
import '@/nodes/tool';
```

- [ ] **Step 3: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(nodes): Tool node definition (emits toolDefinition payload)"
```

---

## Task 5: Tool Group node — aggregator

**Files:**
- Create: `src/nodes/tool-group.ts`

- [ ] **Step 1: Create src/nodes/tool-group.ts**

```ts
// src/nodes/tool-group.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolDefinitionPayload } from './tool';

function flatten(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as ToolDefinitionPayload[];
  return [input as ToolDefinitionPayload];
}

export const toolGroupNode: NodeDefinition = {
  type: 'tool-group',
  inputPorts: ['tools'],
  outputPorts: ['toolDefinition'],
  async run(_node, inputs, ctx) {
    // The runner concatenates whatever its `tools` input received from upstream Tool / Tool Group nodes.
    // Multiple incoming edges land on the same `tools` handle as an array.
    const aggregated = flatten(inputs.tools);

    // Validate: tool names must be unique across the group.
    const seen = new Set<string>();
    const conflicts: string[] = [];
    for (const t of aggregated) {
      if (seen.has(t.name)) conflicts.push(t.name);
      seen.add(t.name);
    }
    if (conflicts.length > 0) {
      throw new Error(`Duplicate tool names in group: ${conflicts.join(', ')}`);
    }

    ctx.details.members = aggregated.map((t) => ({ name: t.name, description: t.description }));
    return { toolDefinition: aggregated };
  },
};

registerNodeDefinition(toolGroupNode);
```

**Note on multi-edge fan-in:** the runner's input-building logic in `src/engine/runner.ts` collects edges into the same target handle. Currently it overwrites; we need to gather them as an array. Update the runner — see Task 6.

- [ ] **Step 2: Add to main.ts**

```ts
import '@/nodes/tool-group';
```

- [ ] **Step 3: typecheck**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(nodes): Tool Group — aggregates tool defs, rejects duplicate names"
```

---

## Task 6: Runner — multi-edge input collection

**Files:**
- Modify: `src/engine/runner.ts`

- [ ] **Step 1: Update input-building loop to handle multiple edges into the same target handle**

In `src/engine/runner.ts`, find the inputs-building section:

```ts
// Build inputs from upstream outputs
const inputs: Record<string, unknown> = {};
for (const edge of incoming.get(id) ?? []) {
  const sourceOutputs = outputsByNode.get(edge.source) ?? {};
  inputs[edge.targetHandle] = sourceOutputs[edge.sourceHandle];
}
```

Replace with:

```ts
// Build inputs from upstream outputs. If multiple edges land on the same target
// handle, collect their source values into a flat array (Tool Group fan-in).
const inputs: Record<string, unknown> = {};
const seenHandles = new Set<string>();
for (const edge of incoming.get(id) ?? []) {
  const sourceOutputs = outputsByNode.get(edge.source) ?? {};
  const value = sourceOutputs[edge.sourceHandle];
  const handle = edge.targetHandle;
  if (seenHandles.has(handle)) {
    // Promote to array on second-and-subsequent edge.
    const existing = inputs[handle];
    inputs[handle] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  } else {
    inputs[handle] = value;
    seenHandles.add(handle);
  }
}
```

This preserves Plan 1's single-edge semantics (input is the value directly) while supporting multi-edge fan-in (input becomes an array).

- [ ] **Step 2: Update Tool Group's `flatten()` to handle either shape**

Already done in Task 5 (`flatten` accepts non-array and wraps).

- [ ] **Step 3: Verify Plan 1 tests still pass**

```bash
npm run test:run
```

Existing tests use single-edge inputs; results should be identical.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(runner): collect multi-edge inputs into arrays for fan-in nodes"
```

---

## Task 7: Tool Runner node — executes tool calls

**Files:**
- Create: `src/nodes/tool-runner.ts`
- Test: `tests/nodes/tool-runner.spec.ts`

- [ ] **Step 1: Write failing test (no LLM mocking — invoke run() directly with synthetic toolCalls)**

`tests/nodes/tool-runner.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { toolRunnerNode } from '@/nodes/tool-runner';
import type { Node } from '@/domain/graph';
import type { ToolDefinitionPayload } from '@/nodes/tool';
import type { ChatMessage } from '@/openrouter/types';

describe('tool-runner node', () => {
  it('executes a matching tool and appends a tool message to the conversation', async () => {
    setActivePinia(createPinia());
    const tools: ToolDefinitionPayload[] = [{
      toolId: 't1', name: 'add', description: 'sum two numbers',
      inputSchema: { type: 'object', properties: { a: {type: 'number'}, b: {type: 'number'} } },
      code: 'return inputs.a + inputs.b;',
      timeoutMs: 1000,
    }];
    const node: Node = { id: 'r', type: 'tool-runner', position: { x: 0, y: 0 }, config: {} };
    const messages: ChatMessage[] = [
      { role: 'user', content: 'add 2 and 3' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'add', arguments: '{"a":2,"b":3}' } }] },
    ];
    const inputs = {
      toolCalls: [{ id: 'c1', type: 'function', function: { name: 'add', arguments: '{"a":2,"b":3}' } }],
      tools,
      messages,
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '' };
    const out = await toolRunnerNode.run(node, inputs, ctx);

    const outMessages = out.messages as ChatMessage[];
    expect(outMessages.length).toBe(3);
    expect(outMessages[2].role).toBe('tool');
    expect(outMessages[2].content).toBe('5');
    expect(outMessages[2].tool_call_id).toBe('c1');
  });

  it('records an error on the result row when tool not found', async () => {
    setActivePinia(createPinia());
    const node: Node = { id: 'r', type: 'tool-runner', position: { x: 0, y: 0 }, config: {} };
    const inputs = {
      toolCalls: [{ id: 'c1', type: 'function', function: { name: 'unknown', arguments: '{}' } }],
      tools: [],
      messages: [],
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '' };
    const out = await toolRunnerNode.run(node, inputs, ctx);
    const results = out.results as Array<{ error?: string }>;
    expect(results[0].error).toMatch(/not found/i);
  });
});
```

- [ ] **Step 2: Run, verify fails**

- [ ] **Step 3: Create src/nodes/tool-runner.ts**

```ts
// src/nodes/tool-runner.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolDefinitionPayload } from './tool';
import type { ChatMessage, ToolCall } from '@/openrouter/types';
import { runInSandbox } from '@/sandbox/runner';

export interface ToolRunResult {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export const toolRunnerNode: NodeDefinition = {
  type: 'tool-runner',
  inputPorts: ['toolCalls', 'tools', 'messages'],
  outputPorts: ['messages', 'results'],
  async run(_node, inputs, ctx) {
    const toolCalls = (inputs.toolCalls as ToolCall[] | undefined) ?? [];
    const tools = (inputs.tools as ToolDefinitionPayload[] | undefined) ?? [];
    const messagesIn = (inputs.messages as ChatMessage[] | undefined) ?? [];

    const byName = new Map(tools.map((t) => [t.name, t]));
    const results: ToolRunResult[] = [];
    const newMessages: ChatMessage[] = [...messagesIn];

    // Execute all tool calls in parallel — the LLM emitted them as a batch.
    await Promise.all(
      toolCalls.map(async (call) => {
        const def = byName.get(call.function.name);
        let parsedInput: Record<string, unknown> = {};
        try { parsedInput = JSON.parse(call.function.arguments || '{}'); } catch { /* leave empty */ }

        if (!def) {
          results.push({ toolCallId: call.id, name: call.function.name, input: parsedInput, error: 'tool not found', durationMs: 0 });
          return;
        }

        const sb = await runInSandbox({
          code: def.code,
          inputs: parsedInput,
          timeoutMs: def.timeoutMs,
          signal: ctx.signal,
        });

        if (sb.kind === 'ok') {
          results.push({ toolCallId: call.id, name: call.function.name, input: parsedInput, output: sb.value, durationMs: sb.durationMs });
        } else {
          results.push({ toolCallId: call.id, name: call.function.name, input: parsedInput, error: sb.message, durationMs: sb.durationMs });
        }
      }),
    );

    // Append `tool` role messages so the next LLM call has the results in conversation.
    for (const r of results) {
      newMessages.push({
        role: 'tool',
        tool_call_id: r.toolCallId,
        name: r.name,
        content: r.error ? `Error: ${r.error}` : String(r.output ?? ''),
      });
    }

    ctx.details.results = results;
    return { messages: newMessages, results };
  },
};

registerNodeDefinition(toolRunnerNode);
```

- [ ] **Step 4: Add to main.ts**

```ts
import '@/nodes/tool-runner';
```

- [ ] **Step 5: Verify tests pass**

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(nodes): Tool Runner — executes tool calls in parallel via sandbox, builds tool-role messages"
```

---

## Task 8: Wire LLM Call to send tools and parse tool calls

**Files:**
- Modify: `src/openrouter/types.ts` (verify), `src/openrouter/client.ts`, `src/nodes/llm-call.ts`
- Test: `tests/openrouter/tool-calls.spec.ts`

- [ ] **Step 1: Test — LLM Call sends tools and emits parsed toolCalls on the output port**

`tests/openrouter/tool-calls.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw';
import { llmCallNode } from '@/nodes/llm-call';
import { setActivePinia, createPinia } from 'pinia';
import type { Node } from '@/domain/graph';

describe('LLM Call with tools', () => {
  it('forwards tool definitions in the request and parses tool_calls from the response', async () => {
    setActivePinia(createPinia());
    let capturedBody: any = null;
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
        capturedBody = await request.json();
        const sse =
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"add","arguments":"{\\"a\\":2,\\"b\\":3}"}}]}}]}\n\n` +
          `data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}\n\n` +
          `data: [DONE]\n\n`;
        return new HttpResponse(sse, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );

    const node: Node = {
      id: 'l', type: 'llm-call', position: { x: 0, y: 0 },
      config: { model: 'm', systemPrompt: '', temperature: 0.5, maxTokens: null, responseFormat: null },
    };
    const tools = [{ toolId: 't1', name: 'add', description: 'add', inputSchema: { type: 'object' }, code: '', timeoutMs: 1000 }];
    const ctx = { signal: new AbortController().signal, details: {} as any, apiKey: 'k' };
    const out = await llmCallNode.run(node, { userMessage: 'add 2 and 3', tools }, ctx);

    expect(capturedBody.tools).toBeDefined();
    expect(capturedBody.tools[0].function.name).toBe('add');
    const toolCalls = out.toolCalls as any[];
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].function.name).toBe('add');
  });
});
```

- [ ] **Step 2: Run, verify fails (currently `tools` aren't forwarded)**

- [ ] **Step 3: Update src/nodes/llm-call.ts**

In the `run()`:

```ts
// after buildMessages — add tools array to the request when present in inputs
const toolsInput = inputs.tools as ToolDefinitionPayload[] | undefined;
const requestTools = toolsInput && toolsInput.length > 0
  ? toolsInput.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }))
  : undefined;

const request: ChatCompletionRequest = {
  model: cfg.model,
  messages,
  temperature: cfg.temperature,
  max_tokens: cfg.maxTokens ?? undefined,
  response_format: cfg.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
  tools: requestTools,
};
```

Also update streamChatCompletion to accumulate tool_calls deltas. In `src/openrouter/client.ts`, in the SSE-parsing loop, accumulate `delta.tool_calls`:

```ts
const toolCallsAcc: Record<number, ToolCall> = {};
// ... inside the chunk loop:
const toolDeltas = choice?.delta?.tool_calls;
if (toolDeltas) {
  for (const td of toolDeltas) {
    const idx = td.index!;
    const acc = toolCallsAcc[idx] ??= { id: '', type: 'function', function: { name: '', arguments: '' } };
    if (td.id) acc.id = td.id;
    if (td.type) acc.type = td.type;
    if (td.function?.name) acc.function.name += td.function.name;
    if (td.function?.arguments) acc.function.arguments += td.function.arguments;
  }
}
```

Add `onToolCalls` callback to `StreamArgs`:

```ts
onToolCalls?: (calls: ToolCall[]) => void;
```

Emit on stream end before `[DONE]` return:

```ts
const finalToolCalls = Object.values(toolCallsAcc);
if (finalToolCalls.length > 0) args.onToolCalls?.(finalToolCalls);
```

In llm-call.ts, capture toolCalls via the callback and return them on the output port:

```ts
let capturedToolCalls: ToolCall[] = [];
const text = await streamChatCompletion({
  // ... existing args
  onToolCalls: (calls) => { capturedToolCalls = calls; },
});

ctx.details.toolCalls = capturedToolCalls;
return { text, toolCalls: capturedToolCalls, messages: finalMessages, usage };
```

- [ ] **Step 4: Verify tests pass (the new one + Plan 1's existing 20)**

```bash
npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(llm-call): forward tools to OpenRouter and emit parsed tool_calls"
```

---

## Task 9: Update graph dirty flag for containsCustomCode

**Files:**
- Modify: `src/stores/graph.ts`

- [ ] **Step 1: Recompute containsCustomCode whenever a Tool node's code changes or a Tool node is added/removed**

Add a helper in graph.ts:

```ts
function recomputeContainsCustomCode() {
  graph.value.containsCustomCode = graph.value.nodes.some(
    (n) => n.type === 'tool' && typeof (n.config as any).code === 'string' && (n.config as any).code.trim().length > 0,
  );
}
```

Call it in `addNode`, `removeNode`, `updateNodeConfig` (and after `load` to be safe).

- [ ] **Step 2: typecheck**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(graph): keep containsCustomCode flag accurate as Tool nodes change"
```

---

## Task 10: Trust prompt modal

**Files:**
- Create: `src/components/TrustPromptModal.vue`
- Modify: `src/stores/ui.ts`, `src/App.vue`

- [ ] **Step 1: Extend ui store**

Add to `src/stores/ui.ts`:

```ts
const trustPromptOpen = ref(false);
const trustGraphPath = ref<string | null>(null);
let trustResolve: ((decision: 'allow' | 'reject') => void) | null = null;

function askForTrust(path: string): Promise<'allow' | 'reject'> {
  trustGraphPath.value = path;
  trustPromptOpen.value = true;
  return new Promise((resolve) => { trustResolve = resolve; });
}

function resolveTrust(decision: 'allow' | 'reject') {
  trustPromptOpen.value = false;
  if (trustResolve) {
    trustResolve(decision);
    trustResolve = null;
  }
}

return { /* ... existing ... */, trustPromptOpen, trustGraphPath, askForTrust, resolveTrust };
```

- [ ] **Step 2: Create TrustPromptModal.vue**

```vue
<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div v-if="ui.trustPromptOpen" class="fixed inset-0 bg-black/60 z-[2500] flex items-center justify-center" @click.self="ui.resolveTrust('reject')">
    <div class="w-[480px] bg-panel border border-border-strong rounded-lg p-5">
      <h2 class="text-base font-semibold mb-2">Custom code detected</h2>
      <p class="text-sm text-text-dim mb-3">
        This graph contains user-authored JavaScript inside Tool nodes. The code will run in a sandboxed Web Worker if you allow it. Only allow if you trust the source.
      </p>
      <div v-if="ui.trustGraphPath" class="font-mono text-[11px] opacity-60 mb-4 truncate">{{ ui.trustGraphPath }}</div>
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 rounded bg-elev border border-border-strong text-sm" @click="ui.resolveTrust('reject')">Don't allow</button>
        <button type="button" class="px-3 py-1.5 rounded bg-accent text-white border border-accent text-sm" @click="ui.resolveTrust('allow')">Run anyway</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Wire into App.vue and gate Open**

In App.vue, modify `onOpen()`:

```ts
async function onOpen() {
  if (!confirmDiscardIfDirty('open another graph')) return;
  const path = await pickGraphFileToOpen();
  if (!path) return;
  const text = await readGraphFile(path);
  const g = parseGraph(text);
  if (g.containsCustomCode) {
    const decision = await ui.askForTrust(path);
    if (decision === 'reject') return;
  }
  graph.load(g, path);
}
```

Also mount `<TrustPromptModal />` in App.vue's template:

```vue
<TrustPromptModal />
```

- [ ] **Step 4: Verify build + manual smoke (open a graph with a Tool node — modal should appear)**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: trust prompt before running graphs containing custom code"
```

---

## Task 11: Monaco editor wrapper

**Files:**
- Create: `src/components/MonacoEditor.vue`

- [ ] **Step 1: Create lazy-loaded Monaco wrapper**

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as monaco from 'monaco-editor';

const props = defineProps<{
  modelValue: string;
  language?: string;
  height?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const containerRef = ref<HTMLDivElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

onMounted(() => {
  if (!containerRef.value) return;
  editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue,
    language: props.language ?? 'javascript',
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 12,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 8, bottom: 8 },
  });
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor!.getValue());
  });
});

watch(() => props.modelValue, (val) => {
  if (editor && val !== editor.getValue()) editor.setValue(val);
});

onBeforeUnmount(() => { editor?.dispose(); editor = null; });
</script>

<template>
  <div ref="containerRef" :style="{ height: height ?? '240px', width: '100%' }" />
</template>
```

- [ ] **Step 2: typecheck + build**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ui): MonacoEditor wrapper component for code editing"
```

---

## Task 12: Tool node card and inspector

**Files:**
- Create: `src/components/nodes/ToolNode.vue`, `src/components/inspectors/ToolInspector.vue`
- Modify: `src/components/Canvas.vue`, `src/components/Inspector.vue`, `src/components/AddNodeMenu.vue`

- [ ] **Step 1: Create ToolNode.vue (header + summary, single right output handle)**

Title: "Tool · {name}". Subtitle: description (truncated). Type-indicator dot color: gold `#ffd54a` (matches the tools wire color).

- [ ] **Step 2: Create ToolInspector.vue**

Form fields: name, description, JSON-schema textarea (with placeholder showing the right shape), Monaco editor for code (lazy-mounted), timeoutMs.

- [ ] **Step 3: Register in Canvas.vue's nodeTypes**

```ts
import ToolNode from './nodes/ToolNode.vue';
const nodeTypes = { /* ... */, tool: markRaw(ToolNode) } as Record<string, ReturnType<typeof markRaw>>;
```

- [ ] **Step 4: Register in Inspector.vue's type switch**

- [ ] **Step 5: Add to AddNodeMenu.vue's options + default config**

```ts
{ type: 'tool', label: 'Tool', description: 'Define a callable function the LLM can use' },
// in defaultConfig:
case 'tool': return {
  name: 'my_tool',
  description: 'Describe what this tool does',
  inputSchema: { type: 'object', properties: {} },
  code: 'return null;',
  timeoutMs: 30000,
};
```

- [ ] **Step 6: Build + manual test (add a Tool node, edit code, verify inspector renders)**

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(ui): Tool node card + inspector with Monaco code editor"
```

---

## Task 13: Tool Group node card and inspector

**Files:**
- Create: `src/components/nodes/ToolGroupNode.vue`, `src/components/inspectors/ToolGroupInspector.vue`
- Modify: `Canvas.vue`, `Inspector.vue`, `AddNodeMenu.vue`

- [ ] **Step 1: Create ToolGroupNode.vue**

Header: "Tool Group · {label}". Single right output port (`toolDefinition`, gold). Single left input port (`tools`, gold) — accepts multiple incoming edges.

- [ ] **Step 2: Create ToolGroupInspector.vue**

Form: label. Below: read-only members list (computed from the latest run's `details.members`). Conflicts (duplicate names) shown in red.

- [ ] **Step 3: Register in Canvas.vue, Inspector.vue, AddNodeMenu.vue**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): Tool Group node card + inspector"
```

---

## Task 14: Tool Runner node card and inspector

**Files:**
- Create: `src/components/nodes/ToolRunnerNode.vue`, `src/components/inspectors/ToolRunnerInspector.vue`
- Modify: `Canvas.vue`, `Inspector.vue`, `AddNodeMenu.vue`

- [ ] **Step 1: Create ToolRunnerNode.vue**

Three target ports left (toolCalls — pink, tools — gold, messages — purple). Two source ports right (messages — purple, results — cyan). Body shows count of last tool calls run.

- [ ] **Step 2: Create ToolRunnerInspector.vue**

Read-only summary of the last invocation: per-tool-call rows showing `name`, parsed input (collapsible JSON), output (or error), duration. Use `result.value?.details?.results`.

- [ ] **Step 3: Register everywhere**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): Tool Runner node card + inspector with per-call detail rows"
```

---

## Task 15: Run persistence — save run JSON after each completion

**Files:**
- Create: `src/persistence/run-io.ts`, `src/persistence/runs-dir.ts`
- Test: `tests/persistence/run-io.spec.ts`
- Modify: `src/engine/runner.ts`, `src/App.vue` (or wherever runs are triggered)

- [ ] **Step 1: Test — runs round-trip**

`tests/persistence/run-io.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeRun, parseRun, runFileName } from '@/persistence/run-io';
import type { Run } from '@/domain/run';

describe('run-io', () => {
  const sample: Run = {
    schemaVersion: 1, id: 'r1', graphId: 'g1', graphSnapshot: { /* minimal */ } as any,
    startedAt: '2026-05-02T10:00:00.000Z', endedAt: '2026-05-02T10:00:01.000Z',
    status: 'completed', inputs: {}, nodeResults: {}, errors: [],
  };

  it('round-trips', () => {
    expect(parseRun(serializeRun(sample))).toEqual(sample);
  });

  it('runFileName uses ISO-safe filename', () => {
    const name = runFileName(sample);
    expect(name).toMatch(/^2026-05-02T10-00-00-.+\.run\.json$/);
  });
});
```

- [ ] **Step 2: Create run-io.ts**

```ts
// src/persistence/run-io.ts
import type { Run } from '@/domain/run';
// (Optional: add zod schema later — for v1, trust the writer.)

export function serializeRun(run: Run): string {
  return JSON.stringify(run, null, 2);
}

export function parseRun(json: string): Run {
  return JSON.parse(json) as Run;
}

export function runFileName(run: Run): string {
  const safe = run.startedAt.replace(/[:.]/g, '-');
  return `${safe}-${run.id.slice(0, 6)}.run.json`;
}

/** Folder convention: <graphFile>.runs/ next to the graph file. */
export function runsFolderForGraph(graphFilePath: string): string {
  return graphFilePath.replace(/\.graph\.json$/, '') + '.runs';
}
```

- [ ] **Step 3: Create runs-dir.ts (Tauri FS calls)**

```ts
// src/persistence/runs-dir.ts
import { mkdir, readDir, readTextFile, writeTextFile, remove, exists } from '@tauri-apps/plugin-fs';
import { runsFolderForGraph } from './run-io';
import type { Run } from '@/domain/run';
import { serializeRun, parseRun, runFileName } from './run-io';

export async function ensureRunsFolder(graphFilePath: string): Promise<string> {
  const folder = runsFolderForGraph(graphFilePath);
  if (!(await exists(folder))) await mkdir(folder, { recursive: true });
  return folder;
}

export async function writeRun(graphFilePath: string, run: Run): Promise<string> {
  const folder = await ensureRunsFolder(graphFilePath);
  const path = `${folder}/${runFileName(run)}`;
  await writeTextFile(path, serializeRun(run));
  return path;
}

export async function listRunFiles(graphFilePath: string): Promise<Array<{ name: string; path: string }>> {
  const folder = runsFolderForGraph(graphFilePath);
  if (!(await exists(folder))) return [];
  const entries = await readDir(folder);
  return entries
    .filter((e) => e.name?.endsWith('.run.json'))
    .map((e) => ({ name: e.name!, path: `${folder}/${e.name}` }))
    .sort((a, b) => b.name.localeCompare(a.name));   // newest first
}

export async function readRun(path: string): Promise<Run> {
  return parseRun(await readTextFile(path));
}

export async function deleteRun(path: string): Promise<void> {
  await remove(path);
}
```

- [ ] **Step 4: Update Tauri capabilities for new fs ops**

In `src-tauri/capabilities/default.json`, add to permissions:

```json
"fs:allow-mkdir",
"fs:allow-read-dir",
"fs:allow-remove",
"fs:allow-exists"
```

- [ ] **Step 5: Save run after completion**

In `src/engine/runner.ts`, after `runStore.finish(run.status)`, write to disk if a graph file path is known:

```ts
const graphStore = useGraphStore();
if (graphStore.filePath) {
  try { await writeRun(graphStore.filePath, run); } catch (e) { console.error('Failed to save run:', e); }
}
```

(Untitled graphs don't have a path; runs in that state are not persisted. The user must Save the graph first.)

- [ ] **Step 6: cargo check, npm typecheck, tests**

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(persistence): save runs to <graph>.runs/<timestamp>.run.json after each execution"
```

---

## Task 16: Runs store + Runs tab UI

**Files:**
- Create: `src/stores/runs.ts`, `src/components/runs/RunsList.vue`, `src/components/runs/RunRow.vue`
- Modify: `src/components/LeftTabs.vue`

- [ ] **Step 1: Create runs store**

```ts
// src/stores/runs.ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useGraphStore } from './graph';
import { listRunFiles, readRun } from '@/persistence/runs-dir';
import type { Run } from '@/domain/run';

export interface RunSummary {
  path: string;
  name: string;
  startedAt: string;
  status: string;
  durationMs?: number;
  tokens?: number;
  inputExcerpt?: string;
  outputExcerpt?: string;
}

export const useRunsStore = defineStore('runs', () => {
  const list = ref<RunSummary[]>([]);
  const loading = ref(false);
  const graph = useGraphStore();

  async function refresh() {
    if (!graph.filePath) { list.value = []; return; }
    loading.value = true;
    try {
      const files = await listRunFiles(graph.filePath);
      const summaries: RunSummary[] = [];
      for (const f of files) {
        try {
          const r = await readRun(f.path);
          summaries.push(toSummary(r, f));
        } catch { /* skip malformed */ }
      }
      list.value = summaries;
    } finally { loading.value = false; }
  }

  function toSummary(r: Run, f: { name: string; path: string }): RunSummary {
    const tokens = Object.values(r.nodeResults)
      .map((nr) => (nr.details?.usage as { input?: number; output?: number } | undefined))
      .filter(Boolean)
      .reduce((sum, u) => sum + (u!.input ?? 0) + (u!.output ?? 0), 0);
    const duration = r.endedAt ? new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime() : undefined;
    return {
      path: f.path,
      name: f.name,
      startedAt: r.startedAt,
      status: r.status,
      durationMs: duration,
      tokens,
      inputExcerpt: '', outputExcerpt: '',  // populated from first input / last assistant response if you want richer rows
    };
  }

  // Auto-refresh when the open graph changes.
  watch(() => graph.filePath, () => { void refresh(); }, { immediate: true });

  return { list, loading, refresh };
});
```

- [ ] **Step 2: Refresh runs after every run completion**

In `src/engine/runner.ts` after `writeRun(...)`, call `useRunsStore().refresh()`.

- [ ] **Step 3: Create RunRow.vue (rich-preview row matching the UI prototype)**

Status icon + timestamp + duration + tokens; inputExcerpt + outputExcerpt; right-click opens a context menu (Delete / Open file).

- [ ] **Step 4: Create RunsList.vue**

Iterates `runs.list`, renders RunRow per item. Shows "No runs yet" empty state when list is empty (matches Plan 1's locked decision: minimal empty state).

- [ ] **Step 5: Mount in LeftTabs.vue**

Replace the placeholder `<div v-else class="...">No runs yet</div>` with `<RunsList />`.

- [ ] **Step 6: typecheck, build, manual smoke**

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(ui): Runs tab with rich-preview rows; auto-refresh on graph change and after each run"
```

---

## Task 17: Click run row → load run into canvas

**Files:**
- Modify: `src/stores/runs.ts`, `src/stores/run.ts`, `src/components/runs/RunRow.vue`

- [ ] **Step 1: Add `loadedRunPath` to runs store**

```ts
const loadedRunPath = ref<string | null>(null);

async function loadRun(path: string) {
  const r = await readRun(path);
  // Replace the active runStore state with this snapshot.
  const runStore = useRunStore();
  runStore.start(r);
  runStore.finish(r.status as any);  // immediately mark as the historical state
  loadedRunPath.value = path;
}
```

- [ ] **Step 2: Wire RunRow's click handler**

```ts
function onClick() { void runs.loadRun(props.summary.path); }
```

- [ ] **Step 3: Visual indicator on the loaded row**

`runs.loadedRunPath === props.summary.path` → highlighted border / accent left-edge.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(runs): click row to load that run into the canvas/inspector state"
```

---

## Task 18: Right-click run row → Delete / Open file

**Files:**
- Modify: `src/components/runs/RunRow.vue`

- [ ] **Step 1: Tiny in-row context menu (no library; just a div pinned to cursor)**

On `@contextmenu.prevent`, show a small menu with two items:
- **Delete** — calls `deleteRun(path)`, then `runs.refresh()`.
- **Open file** — uses `tauri-plugin-opener` to reveal the JSON file in Finder.

- [ ] **Step 2: Add `opener:allow-reveal-item-in-dir` (or equivalent) to Tauri capabilities**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(runs): right-click context menu (Delete / Open file)"
```

---

## Task 19: Update the design spec with Plan 2 deviations

**Files:**
- Modify: `docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md`

- [ ] **Step 1: Note Plan 2 outcomes in spec**

Add a "Plan 2 implementation notes" subsection under Section 19 listing:
- Worker sandbox uses vanilla `Worker` + `postMessage`, no comlink
- Multi-edge fan-in into the same target handle is supported (used by Tool Group)
- Run persistence path: `<graphPath without .graph.json>.runs/<isoSafeTimestamp>-<idShort>.run.json`
- Trust prompt is a single allow/reject (no "remember this" persistence in v1)

- [ ] **Step 2: Commit**

```bash
git commit -am "docs(spec): Plan 2 implementation notes"
```

---

## Task 20: End-to-end smoke test + README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Build + typecheck + tests**

```bash
npm run typecheck && npm run build && npm run test:run
cd src-tauri && cargo check
```

All clean.

- [ ] **Step 2: Manual smoke test (with a real OpenRouter key)**

1. Open the app, create a new graph.
2. Add: Input → LLM Call → Tool Runner → LLM Call → Output. Plus a Tool node connected to a Tool Group, then to the LLM Call's `tools` and Tool Runner's `tools`.
3. Define one tool: name `add`, code `return inputs.a + inputs.b;`, schema `{type:"object",properties:{a:{type:"number"},b:{type:"number"}},required:["a","b"]}`.
4. Set Input default to "what is 2 + 3? use the add tool".
5. Wire LLM Call's `messages` source → second LLM Call's `messages` target. Wire LLM Call's `toolCalls` → Tool Runner's `toolCalls`. Wire Tool Runner's `messages` → second LLM Call's `messages`. Wire second LLM Call's `text` → Output.
6. Click Run. First LLM emits a `tool_calls` for `add`. Tool Runner executes it → 5. Second LLM gets the tool result and produces a final answer. Output shows the answer.
7. Open the Runs tab — see one rich-preview row. Click it — canvas state reloads.
8. Right-click the run — Delete works, file disappears from list.

- [ ] **Step 3: Update README**

Add a "Plan 2 status" line:
- Tool / Tool Group / Tool Runner nodes
- Web Worker sandbox for user code
- Persistent run history in `<graph>.runs/`
- Runs tab populated with rich-preview rows; click to load

- [ ] **Step 4: Commit**

```bash
git commit -am "docs: README for Plan 2 milestone"
```

---

## Self-Review Checklist

Before declaring Plan 2 done:

**Spec coverage** (against design spec):
- [ ] **Section 6.4 Tool** — implemented: config (name/description/schema/code/timeoutMs), `toolDefinition` output port, sandbox execution
- [ ] **Section 6.5 Tool Group** — implemented: aggregates tool defs, rejects duplicates, single output port
- [ ] **Section 6.6 Tool Runner** — implemented: takes toolCalls + tools + messages, executes in parallel, emits extended messages + results
- [ ] **Section 7.3 Multi-edge inputs** — runner now collects array on duplicate target handle
- [ ] **Section 9 Persistent runs** — runs saved to `<graph>.runs/`, listed in Runs tab, click-to-load
- [ ] **Section 11 Sandbox** — Web Worker per-invocation, timeoutMs cap, fetch+log helpers, no DOM/Pinia/keychain access
- [ ] **Section 14 Security** — trust prompt before opening graphs with `containsCustomCode: true`; sandbox isolation verified by tests; no path leakage

**Type / wire consistency:**
- [ ] All new node types in port-types.ts, with correct DataType values
- [ ] `tools` (definitions) is distinct from `tool-calls` (invocations)
- [ ] LLM Call's `tools` target accepts both single Tool and Tool Group via the existing logic
- [ ] Color-coded handles match types

**Testing:**
- [ ] `runner.spec.ts` covers ok / error / timeout / log paths
- [ ] `tool-runner.spec.ts` covers happy path and tool-not-found error
- [ ] `tool-calls.spec.ts` covers SSE streaming with tool_calls deltas
- [ ] `run-io.spec.ts` covers serialize/parse round-trip
- [ ] All Plan 1 tests still pass

**No placeholders:** scan for "TBD", "TODO", "implement later", incomplete tasks.

**File sizes:** confirm no file is over ~300 lines without justification.
