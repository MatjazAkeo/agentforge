# AI Agent Playground — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest interesting slice of the playground: a Tauri 2 desktop app where you can wire `Input → LLM Call → Output` on a Vue Flow canvas, save the graph to disk, click Run, and watch tokens stream live from a free OpenRouter model into the Inspector.

**Architecture:** Tauri 2 shell wrapping a Vue 3 + TypeScript + Vite frontend. All execution logic in TypeScript (the webview); Rust commands only for filesystem and OS keychain. The execution engine traverses a DAG, fires nodes in topological order, and streams LLM responses via `fetch` + ReadableStream. State managed by Pinia. UI follows the locked decisions from the design spec (Section 18): three-column layout with left tab sidebar (Chat | Runs — placeholders in this plan), center Vue Flow canvas, right Inspector with collapsible sections.

**Tech Stack:** Tauri 2 (Rust shell), Vue 3, TypeScript (strict), Vite, Pinia, Vue Flow (`@vue-flow/core`), Monaco editor (loaded but unused in Plan 1 — used in Plan 2), `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-stronghold` (or `tauri-plugin-keyring` fallback) for secrets, Vitest for unit tests, MSW (Mock Service Worker) for OpenRouter HTTP mocking, `zod` for schema validation.

**Reference docs:** Design spec at `docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md` — read Sections 1-7, 9, 11, 12, 17, 18 before starting.

---

## File Structure

This plan establishes the project's baseline file structure. Each file has one clear responsibility.

```
agent_playground/
├── src-tauri/                          # Rust shell
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs                     # Tauri entrypoint, plugin registration
│       └── secrets.rs                  # Wrapper around stronghold/keyring (one Rust command per op)
│
├── src/                                # Vue 3 frontend
│   ├── main.ts                         # Vue app bootstrap
│   ├── App.vue                         # Top-level layout shell
│   ├── env.d.ts                        # Vite env declarations
│   │
│   ├── domain/                         # Pure types and schemas, no Vue/Tauri imports
│   │   ├── graph.ts                    # Graph, Node, Edge types
│   │   ├── run.ts                      # Run, NodeResult, IterationRecord types
│   │   ├── node-types.ts               # NodeType union + per-type config interfaces
│   │   └── schemas.ts                  # zod schemas for validation
│   │
│   ├── nodes/                          # Per-node-type definitions
│   │   ├── registry.ts                 # Node type registry — metadata + run() function per type
│   │   ├── input.ts                    # Input node definition + run()
│   │   ├── output.ts                   # Output node definition + run()
│   │   └── llm-call.ts                 # LLM Call node definition + run() (streaming)
│   │
│   ├── components/                     # Vue components
│   │   ├── Layout.vue                  # 3-column layout (LeftTabs | Canvas | Inspector)
│   │   ├── Toolbar.vue                 # In-window toolbar (graph name, run stats, Run/Stop)
│   │   ├── LeftTabs.vue                # Chat | Runs tab container (Plan 1: placeholders)
│   │   ├── Canvas.vue                  # Vue Flow wrapper + add-node UX
│   │   ├── Inspector.vue               # Right panel with collapsible sections
│   │   ├── Settings.vue                # Settings page (API Key + Models + General tabs)
│   │   ├── OnboardingWelcome.vue       # 3-step first-launch flow
│   │   ├── AddNodeMenu.vue             # Shared palette/right-click/⌘K component
│   │   ├── nodes/
│   │   │   ├── InputNode.vue           # Vue Flow custom node renderer for input
│   │   │   ├── OutputNode.vue
│   │   │   └── LLMCallNode.vue
│   │   └── inspectors/
│   │       ├── InputInspector.vue
│   │       ├── OutputInspector.vue
│   │       └── LLMCallInspector.vue
│   │
│   ├── stores/                         # Pinia stores
│   │   ├── graph.ts                    # Current graph + nodes/edges + dirty state
│   │   ├── run.ts                      # Current run + per-node results + live stats
│   │   ├── settings.ts                 # API key (in-memory mirror), models list
│   │   └── ui.ts                       # Sidebar collapse state, selected node, etc.
│   │
│   ├── engine/                         # Execution engine
│   │   ├── scheduler.ts                # Topological traversal + AND-semantics gate
│   │   ├── lifecycle.ts                # Per-node state machine
│   │   └── abort.ts                    # AbortController plumbing
│   │
│   ├── openrouter/                     # OpenRouter HTTP client
│   │   ├── client.ts                   # Typed fetch wrapper, streaming via ReadableStream
│   │   └── types.ts                    # OpenRouter request/response types
│   │
│   ├── persistence/                    # File save/load
│   │   ├── graph-io.ts                 # Save/load *.graph.json with schema validation
│   │   └── tauri-fs.ts                 # Thin wrapper over Tauri FS commands
│   │
│   ├── secrets/                        # Frontend secrets bridge
│   │   └── api-key.ts                  # Save/load/delete OpenRouter API key (calls Rust)
│   │
│   ├── config/
│   │   └── default-models.ts           # Curated list of free OpenRouter models
│   │
│   └── styles/
│       └── tokens.css                  # Color tokens (dark theme baseline)
│
├── tests/                              # Vitest tests mirror src/ structure
│   ├── domain/schemas.spec.ts
│   ├── nodes/input.spec.ts
│   ├── nodes/output.spec.ts
│   ├── nodes/llm-call.spec.ts
│   ├── engine/scheduler.spec.ts
│   ├── openrouter/client.spec.ts
│   ├── persistence/graph-io.spec.ts
│   └── setup/msw.ts                    # MSW handlers for OpenRouter
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── index.html
```

**File sizing target:** keep each file under ~250 lines. If a file grows past that, split by responsibility.

---

## Task 1: Initialize Tauri 2 + Vue 3 + TypeScript + Vite project

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src/main.ts`, `src/App.vue`, `src/env.d.ts`

- [ ] **Step 1: Run the Tauri create command**

```bash
cd /Users/matjazfikfak/PhpstormProjects/agent_playground
npm create tauri-app@latest -- --tauri-version 2 --frontend vue --typescript --manager npm --target . --identifier com.akeo.agent-playground --window-title "Agent Playground"
```

If the directory already has files (which it does — `docs/`, `.claude/`), the scaffolder will warn. Move existing files temporarily or use `--overwrite` if confirmed safe. Recommended: scaffold into a temp directory, then copy generated files in, preserving `docs/` and `.claude/`:

```bash
mkdir /tmp/ap-scaffold
cd /tmp/ap-scaffold
npm create tauri-app@latest -- --tauri-version 2 --frontend vue --typescript --manager npm --target . --identifier com.akeo.agent-playground --window-title "Agent Playground"
# Copy everything except docs/, .claude/, .idea/
rsync -av --exclude='docs/' --exclude='.claude/' --exclude='.idea/' --exclude='node_modules/' /tmp/ap-scaffold/ /Users/matjazfikfak/PhpstormProjects/agent_playground/
cd /Users/matjazfikfak/PhpstormProjects/agent_playground
npm install
```

Expected: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/`, `src-tauri/` exist; `node_modules/` populated.

- [ ] **Step 2: Initialize git and add a .gitignore**

```bash
cd /Users/matjazfikfak/PhpstormProjects/agent_playground
git init
```

Create `.gitignore` with:

```
node_modules/
dist/
src-tauri/target/
src-tauri/gen/
.DS_Store
.superpowers/
```

- [ ] **Step 3: Verify the dev shell launches**

Run: `npm run tauri dev`
Expected: a Tauri window opens showing the default Vue welcome screen. Close the window.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri 2 + Vue 3 + TypeScript project"
```

---

## Task 2: Install dependencies, configure Vitest, set up MSW

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `tests/setup/msw.ts`, `tests/setup/global.ts`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install pinia @vue-flow/core @vue-flow/controls @vue-flow/minimap @vue-flow/background zod monaco-editor
```

- [ ] **Step 2: Install Tauri plugins**

```bash
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-dialog
```

For secrets, attempt stronghold first:

```bash
npm install @tauri-apps/plugin-stronghold
```

If stronghold isn't desired (it requires a passphrase + has a heavier setup), fall back to a community keyring plugin. The plan continues assuming **stronghold**; substitution in `src/secrets/api-key.ts` is straightforward if you change later.

- [ ] **Step 3: Add the corresponding Rust crates**

Edit `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-stronghold = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 4: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui jsdom @vue/test-utils msw happy-dom
```

- [ ] **Step 5: Create vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/global.ts'],
    globals: true,
  },
});
```

- [ ] **Step 6: Create tests/setup/global.ts and tests/setup/msw.ts**

`tests/setup/global.ts`:

```ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`tests/setup/msw.ts`:

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://openrouter.ai/api/v1/models', () =>
    HttpResponse.json({ data: [] }),
  ),
];

export const server = setupServer(...handlers);
```

- [ ] **Step 7: Add npm scripts**

Edit `package.json` `scripts`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

- [ ] **Step 8: Verify the test runner works**

Run: `npm run test:run`
Expected: "No test files found" — that's correct (we haven't written any yet).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: install runtime + dev dependencies, configure Vitest with MSW"
```

---

## Task 3: Define domain types and schemas

**Files:**
- Create: `src/domain/graph.ts`, `src/domain/run.ts`, `src/domain/node-types.ts`, `src/domain/schemas.ts`
- Test: `tests/domain/schemas.spec.ts`

- [ ] **Step 1: Write the failing schema tests**

`tests/domain/schemas.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { graphSchema } from '@/domain/schemas';

describe('graphSchema', () => {
  const validGraph = {
    schemaVersion: 1,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Test',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    nodes: [],
    edges: [],
    containsCustomCode: false,
  };

  it('accepts a minimal valid graph', () => {
    expect(graphSchema.safeParse(validGraph).success).toBe(true);
  });

  it('rejects a graph with wrong schemaVersion', () => {
    const bad = { ...validGraph, schemaVersion: 99 };
    expect(graphSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a graph missing required fields', () => {
    const bad: any = { ...validGraph };
    delete bad.id;
    expect(graphSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a graph with one Input and one Output node', () => {
    const graph = {
      ...validGraph,
      nodes: [
        { id: 'a', type: 'input', position: { x: 0, y: 0 }, config: { name: 'q', valueType: 'text', defaultValue: '' } },
        { id: 'b', type: 'output', position: { x: 200, y: 0 }, config: { format: 'auto' } },
      ],
      edges: [
        { id: 'e1', source: 'a', sourceHandle: 'value', target: 'b', targetHandle: 'value' },
      ],
    };
    expect(graphSchema.safeParse(graph).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/domain/schemas.spec.ts`
Expected: FAIL with "Cannot find module '@/domain/schemas'".

- [ ] **Step 3: Create src/domain/node-types.ts**

```ts
// src/domain/node-types.ts
export type NodeType =
  | 'input'
  | 'output'
  | 'llm-call'
  | 'tool'
  | 'tool-group'
  | 'tool-runner'
  | 'prompt-template'
  | 'transform'
  | 'loop-controller'
  | 'break'
  | 'agent'
  | 'chat-input'
  | 'chat-output';

export interface InputConfig {
  name: string;
  valueType: 'text' | 'number' | 'json';
  defaultValue: unknown;
}

export interface OutputConfig {
  format: 'auto' | 'text' | 'json' | 'markdown';
}

export interface LLMCallConfig {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number | null;
  responseFormat: 'text' | 'json_object' | null;
}

// Plan 1 defines only these three. Other node-type configs come in later plans
// but the union type is declared up-front for stability.
export type NodeConfig = InputConfig | OutputConfig | LLMCallConfig | Record<string, unknown>;
```

- [ ] **Step 4: Create src/domain/graph.ts**

```ts
// src/domain/graph.ts
import type { NodeType, NodeConfig } from './node-types';

export interface Position {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  type: NodeType;
  position: Position;
  config: NodeConfig;
}

export interface Edge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface Graph {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  nodes: Node[];
  edges: Edge[];
  containsCustomCode: boolean;
}
```

- [ ] **Step 5: Create src/domain/run.ts**

```ts
// src/domain/run.ts
import type { Graph } from './graph';

export type NodeStatus = 'idle' | 'running' | 'streaming' | 'done' | 'error';

export interface NodeResultDetails {
  // Plan 1 keeps this open; per-type details added by node implementations
  [key: string]: unknown;
}

export interface IterationRecord {
  iteration: number;
  startedAt: string;
  endedAt?: string;
  inputs: Record<string, unknown>;
  output?: unknown;
  details?: NodeResultDetails;
}

export interface NodeResult {
  nodeId: string;
  status: NodeStatus;
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  iterations?: IterationRecord[];
  details: NodeResultDetails;
  errorMessage?: string;
  errorStack?: string;
}

export interface RunError {
  nodeId: string;
  message: string;
  stack?: string;
}

export type RunStatus = 'running' | 'completed' | 'failed' | 'aborted';

export interface Run {
  schemaVersion: 1;
  id: string;
  graphId: string;
  graphSnapshot: Graph;
  startedAt: string;
  endedAt: string | null;
  status: RunStatus;
  inputs: Record<string, unknown>;
  nodeResults: Record<string, NodeResult>;
  errors: RunError[];
}
```

- [ ] **Step 6: Create src/domain/schemas.ts**

```ts
// src/domain/schemas.ts
import { z } from 'zod';

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const nodeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'input', 'output', 'llm-call', 'tool', 'tool-group', 'tool-runner',
    'prompt-template', 'transform', 'loop-controller', 'break', 'agent',
    'chat-input', 'chat-output',
  ]),
  position: positionSchema,
  config: z.record(z.unknown()),
});

export const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string(),
  target: z.string(),
  targetHandle: z.string(),
});

export const graphSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  containsCustomCode: z.boolean(),
});

export type GraphFromSchema = z.infer<typeof graphSchema>;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:run -- tests/domain/schemas.spec.ts`
Expected: 4 tests pass.

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: domain types and zod schemas for Graph, Node, Edge, Run"
```

---

## Task 4: Pinia stores skeleton

**Files:**
- Create: `src/stores/graph.ts`, `src/stores/run.ts`, `src/stores/settings.ts`, `src/stores/ui.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/stores/graph.ts**

```ts
// src/stores/graph.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Graph, Node, Edge } from '@/domain/graph';

function newEmptyGraph(): Graph {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: 'Untitled',
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    containsCustomCode: false,
  };
}

export const useGraphStore = defineStore('graph', () => {
  const graph = ref<Graph>(newEmptyGraph());
  const filePath = ref<string | null>(null);
  const dirty = ref(false);

  const nodes = computed(() => graph.value.nodes);
  const edges = computed(() => graph.value.edges);

  function reset() {
    graph.value = newEmptyGraph();
    filePath.value = null;
    dirty.value = false;
  }

  function load(g: Graph, path: string) {
    graph.value = g;
    filePath.value = path;
    dirty.value = false;
  }

  function markSaved(path: string) {
    filePath.value = path;
    dirty.value = false;
  }

  function addNode(node: Node) {
    graph.value.nodes.push(node);
    dirty.value = true;
  }

  function removeNode(id: string) {
    graph.value.nodes = graph.value.nodes.filter((n) => n.id !== id);
    graph.value.edges = graph.value.edges.filter((e) => e.source !== id && e.target !== id);
    dirty.value = true;
  }

  function addEdge(edge: Edge) {
    graph.value.edges.push(edge);
    dirty.value = true;
  }

  function removeEdge(id: string) {
    graph.value.edges = graph.value.edges.filter((e) => e.id !== id);
    dirty.value = true;
  }

  function updateNodeConfig(id: string, config: Record<string, unknown>) {
    const n = graph.value.nodes.find((x) => x.id === id);
    if (n) {
      n.config = { ...n.config, ...config };
      dirty.value = true;
    }
  }

  function updateNodePosition(id: string, x: number, y: number) {
    const n = graph.value.nodes.find((x) => x.id === id);
    if (n) {
      n.position = { x, y };
      dirty.value = true;
    }
  }

  return {
    graph, filePath, dirty, nodes, edges,
    reset, load, markSaved,
    addNode, removeNode, addEdge, removeEdge,
    updateNodeConfig, updateNodePosition,
  };
});
```

- [ ] **Step 2: Create src/stores/run.ts**

```ts
// src/stores/run.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Run, NodeResult, RunStatus } from '@/domain/run';

export const useRunStore = defineStore('run', () => {
  const current = ref<Run | null>(null);
  const totalTokensIn = ref(0);
  const totalTokensOut = ref(0);
  const startedAtMs = ref<number | null>(null);
  const elapsedMs = ref(0);

  const isRunning = computed(() => current.value?.status === 'running');

  function start(run: Run) {
    current.value = run;
    totalTokensIn.value = 0;
    totalTokensOut.value = 0;
    startedAtMs.value = performance.now();
    elapsedMs.value = 0;
  }

  function tick() {
    if (startedAtMs.value !== null && isRunning.value) {
      elapsedMs.value = performance.now() - startedAtMs.value;
    }
  }

  function recordResult(result: NodeResult) {
    if (!current.value) return;
    current.value.nodeResults[result.nodeId] = result;
  }

  function addTokens(input: number, output: number) {
    totalTokensIn.value += input;
    totalTokensOut.value += output;
  }

  function finish(status: RunStatus) {
    if (!current.value) return;
    current.value.status = status;
    current.value.endedAt = new Date().toISOString();
    if (startedAtMs.value !== null) {
      elapsedMs.value = performance.now() - startedAtMs.value;
    }
  }

  return {
    current, totalTokensIn, totalTokensOut, elapsedMs, isRunning,
    start, tick, recordResult, addTokens, finish,
  };
});
```

- [ ] **Step 3: Create src/stores/settings.ts**

```ts
// src/stores/settings.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ModelEntry {
  id: string;
  displayName: string;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  notes: string;
}

export const useSettingsStore = defineStore('settings', () => {
  const apiKey = ref<string | null>(null);     // mirror, not source of truth
  const apiKeyConfigured = ref(false);
  const models = ref<ModelEntry[]>([]);
  const theme = ref<'light' | 'dark' | 'system'>('system');

  function setApiKey(key: string | null) {
    apiKey.value = key;
    apiKeyConfigured.value = key !== null && key.length > 0;
  }

  return { apiKey, apiKeyConfigured, models, theme, setApiKey };
});
```

- [ ] **Step 4: Create src/stores/ui.ts**

```ts
// src/stores/ui.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const leftSidebarCollapsed = ref(false);
  const rightSidebarCollapsed = ref(false);
  const leftActiveTab = ref<'chat' | 'runs'>('runs');
  const selectedNodeId = ref<string | null>(null);
  const settingsOpen = ref(false);

  return {
    leftSidebarCollapsed, rightSidebarCollapsed, leftActiveTab,
    selectedNodeId, settingsOpen,
  };
});
```

- [ ] **Step 5: Wire Pinia in src/main.ts**

```ts
// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/tokens.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
```

- [ ] **Step 6: Create src/styles/tokens.css**

```css
:root {
  --bg-canvas: #1e1e1e;
  --bg-panel: #232323;
  --bg-panel-strong: #2a2a2a;
  --bg-elev: #333;
  --border: #444;
  --border-strong: #555;
  --text: #e6e6e6;
  --text-dim: rgba(230, 230, 230, 0.65);
  --accent: #4a90e2;
  --success: #4caf50;
  --warn: #ffb84a;
  --error: #e94545;
  --loop: #ff9d4a;
  --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg-canvas);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 13px;
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Pinia stores for graph, run, settings, ui + design tokens"
```

---

## Task 5: Layout shell — three columns + toolbar

**Files:**
- Create: `src/components/Layout.vue`, `src/components/Toolbar.vue`, `src/components/LeftTabs.vue`, `src/components/Inspector.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Replace src/App.vue**

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import Layout from './components/Layout.vue';
</script>

<template>
  <Layout />
</template>
```

- [ ] **Step 2: Create src/components/Layout.vue**

```vue
<!-- src/components/Layout.vue -->
<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import Toolbar from './Toolbar.vue';
import LeftTabs from './LeftTabs.vue';
import Inspector from './Inspector.vue';

const ui = useUiStore();
</script>

<template>
  <div class="layout">
    <Toolbar />
    <div class="layout-row">
      <aside v-if="!ui.leftSidebarCollapsed" class="left-panel">
        <LeftTabs />
      </aside>
      <main class="canvas-area">
        <!-- Canvas component injected in Task 9 -->
        <div class="canvas-placeholder">canvas — added in Task 9</div>
      </main>
      <aside v-if="!ui.rightSidebarCollapsed" class="right-panel">
        <Inspector />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; flex-direction: column; height: 100%; }
.layout-row { flex: 1; display: flex; min-height: 0; }
.left-panel { width: 240px; border-right: 1px solid var(--border); background: var(--bg-panel); display: flex; flex-direction: column; }
.right-panel { width: 280px; border-left: 1px solid var(--border); background: var(--bg-panel); display: flex; flex-direction: column; overflow-y: auto; }
.canvas-area { flex: 1; min-width: 0; position: relative; background: var(--bg-canvas); }
.canvas-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.4; }
</style>
```

- [ ] **Step 3: Create src/components/Toolbar.vue**

```vue
<!-- src/components/Toolbar.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useUiStore } from '@/stores/ui';

const graph = useGraphStore();
const run = useRunStore();
const ui = useUiStore();

const displayName = computed(() => {
  const path = graph.filePath;
  if (!path) return 'Untitled';
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1];
});

const elapsedDisplay = computed(() => {
  const ms = run.elapsedMs;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});

function openSettings() { ui.settingsOpen = true; }
function onRun() { /* wired in Task 17 */ }
function onStop() { /* wired in Task 17 */ }
</script>

<template>
  <header class="toolbar">
    <div class="left">
      <strong>{{ displayName }}</strong>
      <span v-if="graph.dirty" class="dirty-dot" title="Unsaved changes">●</span>
    </div>
    <div class="stats" v-if="run.current">
      <span class="stat">in: <strong>{{ run.totalTokensIn }}</strong></span>
      <span class="stat">out: <strong>{{ run.totalTokensOut }}</strong></span>
      <span class="stat">⏱ <strong>{{ elapsedDisplay }}</strong></span>
    </div>
    <div class="right">
      <button class="btn btn-run" @click="onRun" :disabled="run.isRunning">▶ Run</button>
      <button class="btn" @click="onStop" :disabled="!run.isRunning">■ Stop</button>
      <button class="btn btn-icon" @click="openSettings" title="Settings">⚙</button>
    </div>
  </header>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--bg-panel); border-bottom: 1px solid var(--border); }
.left { display: flex; align-items: center; gap: 4px; }
.stats { display: flex; gap: 12px; opacity: 0.85; font-size: 12px; }
.stat { font-variant-numeric: tabular-nums; }
.right { margin-left: auto; display: flex; gap: 6px; }
.btn { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border-strong); border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-run { background: var(--success); border-color: var(--success); color: #0a1f0a; font-weight: 600; }
.btn-run:disabled { background: var(--bg-elev); color: var(--text); }
.btn-icon { padding: 4px 8px; }
.dirty-dot { color: var(--accent); margin-left: 4px; }
</style>
```

- [ ] **Step 4: Create src/components/LeftTabs.vue**

```vue
<!-- src/components/LeftTabs.vue -->
<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div class="left-tabs">
    <div class="tab-bar">
      <button :class="['tab', { active: ui.leftActiveTab === 'chat' }]" @click="ui.leftActiveTab = 'chat'">Chat</button>
      <button :class="['tab', { active: ui.leftActiveTab === 'runs' }]" @click="ui.leftActiveTab = 'runs'">Runs</button>
    </div>
    <div class="tab-body">
      <div v-if="ui.leftActiveTab === 'chat'" class="empty">Not a chat graph</div>
      <div v-else class="empty">No runs yet</div>
    </div>
  </div>
</template>

<style scoped>
.left-tabs { display: flex; flex-direction: column; height: 100%; }
.tab-bar { display: flex; border-bottom: 1px solid var(--border); }
.tab { flex: 1; padding: 8px; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 12px; }
.tab.active { color: var(--text); background: var(--bg-elev); border-bottom: 2px solid var(--accent); }
.tab-body { flex: 1; overflow-y: auto; padding: 12px; }
.empty { display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.5; font-size: 12px; }
</style>
```

- [ ] **Step 5: Create src/components/Inspector.vue**

```vue
<!-- src/components/Inspector.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGraphStore } from '@/stores/graph';

const ui = useUiStore();
const graph = useGraphStore();

const selectedNode = computed(() => {
  if (!ui.selectedNodeId) return null;
  return graph.nodes.find((n) => n.id === ui.selectedNodeId) ?? null;
});
</script>

<template>
  <div class="inspector">
    <div class="header">
      <strong>Inspector</strong>
    </div>
    <div v-if="!selectedNode" class="empty">Select a node</div>
    <div v-else class="content">
      <div class="node-summary">
        <div class="type">{{ selectedNode.type }}</div>
        <div class="id">{{ selectedNode.id.slice(0, 8) }}…</div>
      </div>
      <!-- Per-type inspectors plugged in by Tasks 11, 13, 19 -->
      <div class="placeholder">Inspector content per type added in later tasks.</div>
    </div>
  </div>
</template>

<style scoped>
.inspector { display: flex; flex-direction: column; height: 100%; }
.header { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.empty { padding: 20px; opacity: 0.5; text-align: center; font-size: 12px; }
.content { padding: 12px; }
.node-summary { display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
.type { font-weight: 600; }
.id { opacity: 0.5; font-family: monospace; font-size: 11px; }
.placeholder { opacity: 0.5; font-size: 12px; }
</style>
```

- [ ] **Step 6: Manual smoke test**

Run: `npm run tauri dev`
Expected: window opens with the toolbar at the top, left sidebar showing Chat/Runs tabs (default = Runs, "No runs yet"), middle showing "canvas — added in Task 9", right showing Inspector with "Select a node".

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 3-column layout shell with toolbar and tabbed left sidebar"
```

---

## Task 6: Filesystem wrappers and graph save/load

**Files:**
- Create: `src/persistence/tauri-fs.ts`, `src/persistence/graph-io.ts`
- Test: `tests/persistence/graph-io.spec.ts`

- [ ] **Step 1: Write the failing test for graph-io round-trip**

`tests/persistence/graph-io.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeGraph, parseGraph } from '@/persistence/graph-io';
import type { Graph } from '@/domain/graph';

describe('graph-io', () => {
  const sample: Graph = {
    schemaVersion: 1,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Test',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    nodes: [
      { id: '22222222-2222-4222-8222-222222222222', type: 'input', position: { x: 0, y: 0 }, config: { name: 'q', valueType: 'text', defaultValue: '' } },
    ],
    edges: [],
    containsCustomCode: false,
  };

  it('round-trips a graph through serialize/parse', () => {
    const json = serializeGraph(sample);
    const parsed = parseGraph(json);
    expect(parsed).toEqual(sample);
  });

  it('throws a friendly error on schema mismatch', () => {
    expect(() => parseGraph('{"schemaVersion": 99}')).toThrow(/schema/i);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseGraph('not json')).toThrow(/JSON/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test:run -- tests/persistence/graph-io.spec.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create src/persistence/graph-io.ts**

```ts
// src/persistence/graph-io.ts
import { graphSchema } from '@/domain/schemas';
import type { Graph } from '@/domain/graph';

export function serializeGraph(graph: Graph): string {
  return JSON.stringify(graph, null, 2);
}

export function parseGraph(json: string): Graph {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`Could not parse JSON: ${(e as Error).message}`);
  }
  const parsed = graphSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Graph file does not match schema: ${parsed.error.message}`);
  }
  // The schema permits any node config record; we trust it for now.
  return parsed.data as Graph;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test:run -- tests/persistence/graph-io.spec.ts`
Expected: 3 pass.

- [ ] **Step 5: Create src/persistence/tauri-fs.ts**

```ts
// src/persistence/tauri-fs.ts
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export async function pickGraphFileToOpen(): Promise<string | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'Graph', extensions: ['json'] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export async function pickGraphFileToSave(suggestedName = 'untitled.graph.json'): Promise<string | null> {
  const path = await saveDialog({
    defaultPath: suggestedName,
    filters: [{ name: 'Graph', extensions: ['json'] }],
  });
  return path ?? null;
}

export async function readGraphFile(path: string): Promise<string> {
  return await readTextFile(path);
}

export async function writeGraphFile(path: string, contents: string): Promise<void> {
  await writeTextFile(path, contents);
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: graph-io serialize/parse with schema validation; Tauri FS wrappers"
```

---

## Task 7: Wire File menu (New / Open / Save / Save As)

**Files:**
- Create: `src-tauri/src/menu.rs`
- Modify: `src-tauri/src/main.rs`, `src/App.vue`

The native menu bar is built in Rust, but menu actions are surfaced to the frontend via Tauri events. The frontend listens and calls the right action on the graph store.

- [ ] **Step 1: Create src-tauri/src/menu.rs**

```rust
// src-tauri/src/menu.rs
use tauri::menu::{Menu, MenuBuilder, MenuItem, Submenu, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let new_item = MenuItem::with_id(app, "menu.file.new", "New", true, Some("CmdOrCtrl+N"))?;
    let open_item = MenuItem::with_id(app, "menu.file.open", "Open…", true, Some("CmdOrCtrl+O"))?;
    let save_item = MenuItem::with_id(app, "menu.file.save", "Save", true, Some("CmdOrCtrl+S"))?;
    let save_as_item = MenuItem::with_id(app, "menu.file.save_as", "Save As…", true, Some("CmdOrCtrl+Shift+S"))?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_item)
        .item(&open_item)
        .separator()
        .item(&save_item)
        .item(&save_as_item)
        .build()?;

    let run_item = MenuItem::with_id(app, "menu.run.run", "Run", true, Some("CmdOrCtrl+Return"))?;
    let stop_item = MenuItem::with_id(app, "menu.run.stop", "Stop", true, Some("CmdOrCtrl+."))?;

    let run_menu = SubmenuBuilder::new(app, "Run")
        .item(&run_item)
        .item(&stop_item)
        .build()?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&run_menu)
        .build()
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
    // Forward menu clicks to the frontend as a global Tauri event
    let _ = app.emit("menu", event_id);
}
```

- [ ] **Step 2: Update src-tauri/src/main.rs**

```rust
// src-tauri/src/main.rs
mod menu;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let m = menu::build_menu(&app.handle())?;
            app.set_menu(m)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Wire menu events in App.vue**

Replace `src/App.vue`:

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useGraphStore } from '@/stores/graph';
import { pickGraphFileToOpen, pickGraphFileToSave, readGraphFile, writeGraphFile } from '@/persistence/tauri-fs';
import { parseGraph, serializeGraph } from '@/persistence/graph-io';
import Layout from './components/Layout.vue';

const graph = useGraphStore();
let unlisten: UnlistenFn | null = null;

async function onNew() {
  graph.reset();
}

async function onOpen() {
  const path = await pickGraphFileToOpen();
  if (!path) return;
  const text = await readGraphFile(path);
  const g = parseGraph(text);
  graph.load(g, path);
}

async function onSave() {
  if (!graph.filePath) {
    return onSaveAs();
  }
  const text = serializeGraph(graph.graph);
  await writeGraphFile(graph.filePath, text);
  graph.markSaved(graph.filePath);
}

async function onSaveAs() {
  const path = await pickGraphFileToSave(`${graph.graph.name || 'untitled'}.graph.json`);
  if (!path) return;
  const text = serializeGraph(graph.graph);
  await writeGraphFile(path, text);
  graph.markSaved(path);
}

onMounted(async () => {
  unlisten = await listen<string>('menu', async (e) => {
    switch (e.payload) {
      case 'menu.file.new': await onNew(); break;
      case 'menu.file.open': await onOpen(); break;
      case 'menu.file.save': await onSave(); break;
      case 'menu.file.save_as': await onSaveAs(); break;
    }
  });
});

onUnmounted(() => { unlisten?.(); });
</script>

<template>
  <Layout />
</template>
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run tauri dev`
Expected:
- Native menu bar shows File menu with New / Open… / Save / Save As… and a Run menu
- File → New resets the toolbar to "Untitled"
- File → Save As… opens a save dialog; pick a path; toolbar updates to show the file name
- File → Open… opens that file; toolbar shows the same name and dirty-dot is gone

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: native menu bar with File and Run menus, wired to graph store"
```

---

## Task 8: Vue Flow canvas with empty graph rendering

**Files:**
- Create: `src/components/Canvas.vue`
- Modify: `src/components/Layout.vue`

- [ ] **Step 1: Create src/components/Canvas.vue**

```vue
<!-- src/components/Canvas.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { VueFlow, type Node as VFNode, type Edge as VFEdge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import { useGraphStore } from '@/stores/graph';
import { useUiStore } from '@/stores/ui';

const graph = useGraphStore();
const ui = useUiStore();

const flowNodes = computed<VFNode[]>(() =>
  graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { config: n.config },
  })),
);

const flowEdges = computed<VFEdge[]>(() =>
  graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  })),
);

function onNodeClick({ node }: { node: VFNode }) {
  ui.selectedNodeId = node.id;
}

function onPaneClick() {
  ui.selectedNodeId = null;
}

function onNodeDragStop({ node }: { node: VFNode }) {
  graph.updateNodePosition(node.id, node.position.x, node.position.y);
}
</script>

<template>
  <div class="canvas">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @node-drag-stop="onNodeDragStop"
      :fit-view-on-init="true"
    >
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style scoped>
.canvas { width: 100%; height: 100%; }
</style>
```

- [ ] **Step 2: Update src/components/Layout.vue**

Replace the canvas placeholder:

```vue
<main class="canvas-area">
  <Canvas />
</main>
```

…and import at the top:

```ts
import Canvas from './Canvas.vue';
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run tauri dev`
Expected: empty Vue Flow canvas (background grid, controls bottom-left, minimap bottom-right). No errors in console.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Vue Flow canvas wired to graph store"
```

---

## Task 9: Add-node UX — palette, right-click, ⌘K

**Files:**
- Create: `src/components/AddNodeMenu.vue`
- Modify: `src/components/Canvas.vue`

For Plan 1, only `input`, `output`, `llm-call` are addable from the menu. Other types are added in later plans.

- [ ] **Step 1: Create src/components/AddNodeMenu.vue**

```vue
<!-- src/components/AddNodeMenu.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { Node } from '@/domain/graph';
import type { NodeType } from '@/domain/node-types';

interface NodeOption {
  type: NodeType;
  label: string;
  description: string;
}

// Plan 1 surface
const ALL_OPTIONS: NodeOption[] = [
  { type: 'input', label: 'Input', description: 'Source value into the graph' },
  { type: 'output', label: 'Output', description: 'Display final value' },
  { type: 'llm-call', label: 'LLM Call', description: 'Send a chat completion to OpenRouter' },
];

const props = defineProps<{
  open: boolean;
  position: { x: number; y: number };  // canvas-space spawn position
  screenPosition: { x: number; y: number };  // where the menu floats on screen
}>();
const emit = defineEmits<{ close: [] }>();

const graph = useGraphStore();
const search = ref('');
const focusedIndex = ref(0);

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return ALL_OPTIONS;
  return ALL_OPTIONS.filter((o) =>
    o.label.toLowerCase().includes(q) || o.type.includes(q),
  );
});

watch(() => props.open, (open) => {
  if (open) {
    search.value = '';
    focusedIndex.value = 0;
  }
});

function defaultConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case 'input': return { name: 'input', valueType: 'text', defaultValue: '' };
    case 'output': return { format: 'auto' };
    case 'llm-call': return {
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: null,
      responseFormat: null,
    };
    default: return {};
  }
}

function pick(option: NodeOption) {
  const node: Node = {
    id: crypto.randomUUID(),
    type: option.type,
    position: { ...props.position },
    config: defaultConfig(option.type),
  };
  graph.addNode(node);
  emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusedIndex.value = Math.min(focusedIndex.value + 1, filtered.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const opt = filtered.value[focusedIndex.value];
    if (opt) pick(opt);
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div v-if="open" class="add-node-menu" :style="{ left: `${screenPosition.x}px`, top: `${screenPosition.y}px` }" @click.stop>
    <div class="header">ADD NODE</div>
    <input v-model="search" placeholder="Search…" class="search" autofocus>
    <ul class="options">
      <li v-for="(opt, i) in filtered" :key="opt.type"
          :class="['option', { focused: i === focusedIndex }]"
          @click="pick(opt)" @mouseenter="focusedIndex = i">
        <strong>{{ opt.label }}</strong>
        <div class="desc">{{ opt.description }}</div>
      </li>
      <li v-if="filtered.length === 0" class="empty">No matches</li>
    </ul>
  </div>
</template>

<style scoped>
.add-node-menu { position: fixed; z-index: 1000; min-width: 220px; max-width: 280px; padding: 6px; background: var(--bg-panel-strong); border: 1px solid var(--border-strong); border-radius: 6px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5); }
.header { padding: 4px 6px; opacity: 0.5; font-size: 10px; }
.search { width: calc(100% - 12px); margin: 4px 6px; padding: 4px 6px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 12px; }
.options { list-style: none; margin: 4px 0 0; padding: 0; max-height: 280px; overflow-y: auto; }
.option { padding: 6px 10px; cursor: pointer; border-radius: 3px; }
.option.focused { background: var(--accent); color: white; }
.option .desc { font-size: 11px; opacity: 0.7; }
.option.focused .desc { opacity: 0.9; }
.empty { padding: 8px 10px; opacity: 0.5; font-size: 12px; }
</style>
```

- [ ] **Step 2: Update src/components/Canvas.vue with menu triggers**

Replace `Canvas.vue`:

```vue
<!-- src/components/Canvas.vue -->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { VueFlow, useVueFlow, type Node as VFNode, type Edge as VFEdge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import { useGraphStore } from '@/stores/graph';
import { useUiStore } from '@/stores/ui';
import AddNodeMenu from './AddNodeMenu.vue';

const graph = useGraphStore();
const ui = useUiStore();
const { project } = useVueFlow();

const flowNodes = computed<VFNode[]>(() =>
  graph.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: { config: n.config } })),
);
const flowEdges = computed<VFEdge[]>(() =>
  graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
);

const menuOpen = ref(false);
const menuScreenPos = ref({ x: 0, y: 0 });
const menuCanvasPos = ref({ x: 0, y: 0 });
const canvasRef = ref<HTMLDivElement | null>(null);

function openMenuAt(screenX: number, screenY: number) {
  menuScreenPos.value = { x: screenX, y: screenY };
  // Convert screen coords to canvas coords using Vue Flow's project()
  if (canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect();
    menuCanvasPos.value = project({ x: screenX - rect.left, y: screenY - rect.top });
  }
  menuOpen.value = true;
}

function onPlusClick(e: MouseEvent) {
  e.stopPropagation();
  openMenuAt(e.clientX + 4, e.clientY + 4);
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  openMenuAt(e.clientX, e.clientY);
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openMenuAt(window.innerWidth / 2 - 120, 100);
  }
}

function onNodeClick({ node }: { node: VFNode }) { ui.selectedNodeId = node.id; }
function onPaneClick() { ui.selectedNodeId = null; menuOpen.value = false; }
function onNodeDragStop({ node }: { node: VFNode }) { graph.updateNodePosition(node.id, node.position.x, node.position.y); }

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="canvas" ref="canvasRef" @contextmenu="onContextMenu">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @node-drag-stop="onNodeDragStop"
      :fit-view-on-init="true"
    >
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
    <button class="plus-btn" @click="onPlusClick" title="Add node (or right-click / ⌘K)">+</button>
    <AddNodeMenu :open="menuOpen" :position="menuCanvasPos" :screen-position="menuScreenPos" @close="menuOpen = false" />
  </div>
</template>

<style scoped>
.canvas { width: 100%; height: 100%; position: relative; }
.plus-btn { position: absolute; left: 16px; top: 16px; width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: white; border: none; font-size: 18px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 10; }
</style>
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run tauri dev`
Expected:
- A floating + button in the top-left of the canvas
- Click + → menu opens with Input / Output / LLM Call
- Pick "Input" → a node appears on the canvas (default Vue Flow rendering)
- Right-click empty canvas → same menu opens at the cursor
- ⌘K → menu opens centered

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add-node menu via + button, right-click, and ⌘K"
```

---

## Task 10: Input node — definition, run(), Vue Flow renderer, inspector

**Files:**
- Create: `src/nodes/registry.ts`, `src/nodes/input.ts`, `src/components/nodes/InputNode.vue`, `src/components/inspectors/InputInspector.vue`
- Test: `tests/nodes/input.spec.ts`
- Modify: `src/components/Canvas.vue`, `src/components/Inspector.vue`

- [ ] **Step 1: Create the node registry skeleton**

```ts
// src/nodes/registry.ts
import type { Node } from '@/domain/graph';
import type { NodeType } from '@/domain/node-types';

/** Inputs available to a node's run() function: named values from incoming edges. */
export type RunInputs = Record<string, unknown>;

/** Outputs a node produces: named values keyed by output port name. */
export type RunOutputs = Record<string, unknown>;

export interface NodeRunContext {
  signal: AbortSignal;
  /** Persistable details to attach to this node's NodeResult. */
  details: Record<string, unknown>;
  /** Stream-progress callback (used by LLM Call). Called many times during a run. */
  onStreamUpdate?: (preview: string) => void;
}

export interface NodeDefinition {
  type: NodeType;
  inputPorts: string[];     // names of input ports
  outputPorts: string[];    // names of output ports
  run: (node: Node, inputs: RunInputs, ctx: NodeRunContext) => Promise<RunOutputs>;
}

const definitions = new Map<NodeType, NodeDefinition>();

export function registerNodeDefinition(def: NodeDefinition) {
  definitions.set(def.type, def);
}

export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
  return definitions.get(type);
}
```

- [ ] **Step 2: Write the failing test for Input node**

`tests/nodes/input.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inputNode } from '@/nodes/input';
import type { Node } from '@/domain/graph';

describe('input node', () => {
  it('emits its config defaultValue on the value port', async () => {
    const node: Node = {
      id: 'a', type: 'input', position: { x: 0, y: 0 },
      config: { name: 'q', valueType: 'text', defaultValue: 'hello' },
    };
    const ctx = { signal: new AbortController().signal, details: {} };
    const result = await inputNode.run(node, {}, ctx);
    expect(result).toEqual({ value: 'hello' });
  });

  it('emits 0 when defaultValue is 0 (number type)', async () => {
    const node: Node = {
      id: 'a', type: 'input', position: { x: 0, y: 0 },
      config: { name: 'n', valueType: 'number', defaultValue: 0 },
    };
    const ctx = { signal: new AbortController().signal, details: {} };
    const result = await inputNode.run(node, {}, ctx);
    expect(result).toEqual({ value: 0 });
  });
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `npm run test:run -- tests/nodes/input.spec.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Create src/nodes/input.ts**

```ts
// src/nodes/input.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { InputConfig } from '@/domain/node-types';

export const inputNode: NodeDefinition = {
  type: 'input',
  inputPorts: [],
  outputPorts: ['value'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as InputConfig;
    ctx.details.value = cfg.defaultValue;
    return { value: cfg.defaultValue };
  },
};

registerNodeDefinition(inputNode);
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm run test:run -- tests/nodes/input.spec.ts`
Expected: 2 pass.

- [ ] **Step 6: Create src/components/nodes/InputNode.vue**

```vue
<!-- src/components/nodes/InputNode.vue -->
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';

const props = defineProps<{ id: string; data: { config: { name: string; valueType: string; defaultValue: unknown } } }>();

const preview = computed(() => {
  const v = props.data.config.defaultValue;
  if (v === undefined || v === null || v === '') return '— empty —';
  if (typeof v === 'string') return v.length > 30 ? `${v.slice(0, 30)}…` : v;
  return String(v);
});
</script>

<template>
  <div class="node-card input-card">
    <div class="header">
      <strong>Input</strong>
      <div class="sub">{{ data.config.name }} · {{ data.config.valueType }}</div>
    </div>
    <div class="body">
      <div class="preview">{{ preview }}</div>
    </div>
    <Handle id="value" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.node-card { width: 220px; background: var(--bg-panel-strong); border: 2px solid #888; border-radius: 8px; overflow: hidden; }
.header { padding: 8px 10px; background: var(--bg-elev); border-bottom: 1px solid var(--border); }
.sub { opacity: 0.6; font-size: 10px; }
.body { padding: 8px 10px; min-height: 38px; font-size: 11px; }
.preview { opacity: 0.85; }
</style>
```

- [ ] **Step 7: Create src/components/inspectors/InputInspector.vue**

```vue
<!-- src/components/inspectors/InputInspector.vue -->
<script setup lang="ts">
import { useGraphStore } from '@/stores/graph';
import type { InputConfig } from '@/domain/node-types';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = graph.nodes.find((n) => n.id === props.nodeId);
const cfg = node ? (node.config as InputConfig) : null;

function update<K extends keyof InputConfig>(key: K, value: InputConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="form">
    <label>Name <input :value="cfg.name" @input="(e) => update('name', (e.target as HTMLInputElement).value)"></label>
    <label>Value type
      <select :value="cfg.valueType" @change="(e) => update('valueType', (e.target as HTMLSelectElement).value as any)">
        <option value="text">text</option>
        <option value="number">number</option>
        <option value="json">json</option>
      </select>
    </label>
    <label>Default value
      <textarea :value="String(cfg.defaultValue ?? '')" @input="(e) => update('defaultValue', (e.target as HTMLTextAreaElement).value)" rows="3"></textarea>
    </label>
  </div>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 10px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; opacity: 0.85; }
input, select, textarea { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 12px; font-family: var(--font-ui); }
textarea { resize: vertical; }
</style>
```

- [ ] **Step 8: Wire InputNode into Vue Flow's node-types map**

In `Canvas.vue`, register the custom node type:

```ts
// inside <script setup> of Canvas.vue, after imports
import InputNode from './nodes/InputNode.vue';

const nodeTypes = { input: InputNode };
```

…and pass it to VueFlow:

```vue
<VueFlow
  :nodes="flowNodes"
  :edges="flowEdges"
  :node-types="nodeTypes"
  ...
>
```

- [ ] **Step 9: Wire InputInspector into Inspector.vue**

Replace the placeholder div in `Inspector.vue`:

```vue
<div v-if="selectedNode.type === 'input'">
  <InputInspector :nodeId="selectedNode.id" />
</div>
<div v-else class="placeholder">Inspector for {{ selectedNode.type }} added in a later task.</div>
```

…and import it:

```ts
import InputInspector from './inspectors/InputInspector.vue';
```

- [ ] **Step 10: Manual smoke test**

Run: `npm run tauri dev`
- Add an Input node via + or right-click
- Verify the custom InputNode card renders (with "— empty —")
- Click the node — inspector shows the form
- Edit the default value — preview on the card updates

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: Input node — definition, run(), Vue Flow card, inspector form"
```

---

## Task 11: Output node — definition, run(), Vue Flow renderer, inspector

**Files:**
- Create: `src/nodes/output.ts`, `src/components/nodes/OutputNode.vue`, `src/components/inspectors/OutputInspector.vue`
- Test: `tests/nodes/output.spec.ts`
- Modify: `src/components/Canvas.vue`, `src/components/Inspector.vue`

- [ ] **Step 1: Write the failing test**

`tests/nodes/output.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { outputNode } from '@/nodes/output';
import type { Node } from '@/domain/graph';

describe('output node', () => {
  it('records its incoming value into details', async () => {
    const node: Node = {
      id: 'b', type: 'output', position: { x: 0, y: 0 },
      config: { format: 'auto' },
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown> };
    await outputNode.run(node, { value: 'hello' }, ctx);
    expect(ctx.details.value).toBe('hello');
  });

  it('returns no outputs (terminal node)', async () => {
    const node: Node = {
      id: 'b', type: 'output', position: { x: 0, y: 0 },
      config: { format: 'auto' },
    };
    const ctx = { signal: new AbortController().signal, details: {} };
    const result = await outputNode.run(node, { value: 'x' }, ctx);
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run, verify fails**

Run: `npm run test:run -- tests/nodes/output.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create src/nodes/output.ts**

```ts
// src/nodes/output.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';

export const outputNode: NodeDefinition = {
  type: 'output',
  inputPorts: ['value'],
  outputPorts: [],
  async run(_node, inputs, ctx) {
    ctx.details.value = inputs.value;
    return {};
  },
};

registerNodeDefinition(outputNode);
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test:run -- tests/nodes/output.spec.ts`
Expected: 2 pass.

- [ ] **Step 5: Create src/components/nodes/OutputNode.vue**

```vue
<!-- src/components/nodes/OutputNode.vue -->
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useRunStore } from '@/stores/run';

const props = defineProps<{ id: string; data: { config: { format: string } } }>();
const run = useRunStore();

const result = computed(() => run.current?.nodeResults[props.id]);
const preview = computed(() => {
  const v = result.value?.details?.value;
  if (v === undefined || v === null) return '— not yet run —';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
});
const statusColor = computed(() => {
  switch (result.value?.status) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#888';
  }
});
</script>

<template>
  <div class="node-card output-card" :style="{ borderColor: statusColor }">
    <div class="header">
      <strong>Output</strong>
      <div class="sub">{{ data.config.format }}</div>
    </div>
    <div class="body">{{ preview }}</div>
    <Handle id="value" type="target" :position="Position.Left" />
  </div>
</template>

<style scoped>
.node-card { width: 220px; background: var(--bg-panel-strong); border: 2px solid #888; border-radius: 8px; overflow: hidden; }
.header { padding: 8px 10px; background: var(--bg-elev); border-bottom: 1px solid var(--border); }
.sub { opacity: 0.6; font-size: 10px; }
.body { padding: 8px 10px; min-height: 38px; font-size: 11px; opacity: 0.85; }
</style>
```

- [ ] **Step 6: Create src/components/inspectors/OutputInspector.vue**

```vue
<!-- src/components/inspectors/OutputInspector.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { OutputConfig } from '@/domain/node-types';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as OutputConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);

function update(key: keyof OutputConfig, value: string) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div class="form">
    <label v-if="cfg">Format
      <select :value="cfg.format" @change="(e) => update('format', (e.target as HTMLSelectElement).value)">
        <option value="auto">auto</option>
        <option value="text">text</option>
        <option value="json">json</option>
        <option value="markdown">markdown</option>
      </select>
    </label>
    <section class="value">
      <div class="label">Value</div>
      <pre>{{ result?.details?.value ?? '— not yet run —' }}</pre>
    </section>
  </div>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 10px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; opacity: 0.85; }
select { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 12px; }
.value .label { opacity: 0.6; font-size: 10px; text-transform: uppercase; }
pre { background: var(--bg-panel); padding: 8px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
</style>
```

- [ ] **Step 7: Wire OutputNode + OutputInspector into Canvas.vue and Inspector.vue**

`Canvas.vue` — extend `nodeTypes`:

```ts
import OutputNode from './nodes/OutputNode.vue';
const nodeTypes = { input: InputNode, output: OutputNode };
```

`Inspector.vue` — extend the type switch:

```vue
<div v-if="selectedNode.type === 'input'"><InputInspector :nodeId="selectedNode.id" /></div>
<div v-else-if="selectedNode.type === 'output'"><OutputInspector :nodeId="selectedNode.id" /></div>
<div v-else class="placeholder">Inspector for {{ selectedNode.type }} added in a later task.</div>
```

…and import:

```ts
import OutputInspector from './inspectors/OutputInspector.vue';
```

- [ ] **Step 8: Connect Input → Output via edges**

Vue Flow handles user-drawn edges automatically; we just need to persist them. In `Canvas.vue`, listen for `connect`:

```ts
function onConnect(params: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) {
  graph.addEdge({
    id: crypto.randomUUID(),
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? '',
    targetHandle: params.targetHandle ?? '',
  });
}
```

…and bind it on `<VueFlow @connect="onConnect" ...>`.

- [ ] **Step 9: Manual smoke test**

Run: `npm run tauri dev`
- Add an Input node, an Output node
- Drag from Input's right handle to Output's left handle — edge appears
- Save the graph, reload — nodes and edge persist

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: Output node + connect edges + per-type inspector dispatch"
```

---

## Task 12: Tauri secrets bridge for OpenRouter API key

**Files:**
- Create: `src-tauri/src/secrets.rs`, `src/secrets/api-key.ts`
- Modify: `src-tauri/src/main.rs`

The simplest approach for v1 with stronghold is one-time-init-on-first-use with a hard-coded password derived from the app identifier. Stronghold is overkill if you never plan to integrate biometric auth, but the plugin works out of the box.

For Plan 1 we'll use a **simple alternative**: store the key in Tauri-encrypted Stronghold OR fall back to writing to OS keychain via a custom Rust command using the `keyring` crate. Per the spec we want OS keychain semantics, so let's go that route — simpler and avoids stronghold's password ceremony.

- [ ] **Step 1: Add the keyring crate to src-tauri/Cargo.toml**

```toml
keyring = "3"
```

(Remove `tauri-plugin-stronghold` from the dependencies list and `npm uninstall @tauri-apps/plugin-stronghold` if installed — not needed.)

- [ ] **Step 2: Create src-tauri/src/secrets.rs**

```rust
// src-tauri/src/secrets.rs
use keyring::Entry;

const SERVICE: &str = "agent-playground";
const ACCOUNT_API_KEY: &str = "openrouter.api_key";

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    Entry::new(SERVICE, ACCOUNT_API_KEY)
        .map_err(|e| e.to_string())?
        .set_password(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_api_key() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, ACCOUNT_API_KEY).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    let entry = Entry::new(SERVICE, ACCOUNT_API_KEY).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
```

- [ ] **Step 3: Register the commands in src-tauri/src/main.rs**

```rust
mod menu;
mod secrets;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            secrets::save_api_key,
            secrets::load_api_key,
            secrets::delete_api_key,
        ])
        .setup(|app| {
            let m = menu::build_menu(&app.handle())?;
            app.set_menu(m)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Create src/secrets/api-key.ts**

```ts
// src/secrets/api-key.ts
import { invoke } from '@tauri-apps/api/core';

export async function saveApiKey(key: string): Promise<void> {
  await invoke('save_api_key', { key });
}

export async function loadApiKey(): Promise<string | null> {
  return await invoke<string | null>('load_api_key');
}

export async function deleteApiKey(): Promise<void> {
  await invoke('delete_api_key');
}
```

- [ ] **Step 5: Manual smoke test**

Run: `npm run tauri dev`
In the dev tools console:

```js
const { invoke } = window.__TAURI__.core;
await invoke('save_api_key', { key: 'sk-test-1234' });
await invoke('load_api_key');  // returns "sk-test-1234"
await invoke('delete_api_key');
await invoke('load_api_key');  // returns null
```

Expected: all four calls succeed; the macOS Keychain Access app shows an entry under "agent-playground" / "openrouter.api_key" between save and delete.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: keychain-backed API key storage via Rust commands"
```

---

## Task 13: Settings page (API Key tab) with first-launch detection

**Files:**
- Create: `src/components/Settings.vue`, `src/components/OnboardingWelcome.vue`
- Modify: `src/App.vue`, `src/components/Toolbar.vue`

- [ ] **Step 1: Create src/components/Settings.vue**

```vue
<!-- src/components/Settings.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { saveApiKey, deleteApiKey } from '@/secrets/api-key';

const ui = useUiStore();
const settings = useSettingsStore();
const tab = ref<'api-key' | 'models' | 'general'>('api-key');
const draft = ref(settings.apiKey ?? '');
const testing = ref(false);
const testResult = ref<string | null>(null);

async function onSave() {
  await saveApiKey(draft.value);
  settings.setApiKey(draft.value);
  testResult.value = 'Saved.';
}

async function onClear() {
  await deleteApiKey();
  settings.setApiKey(null);
  draft.value = '';
  testResult.value = 'Cleared.';
}

async function onTest() {
  testing.value = true;
  testResult.value = null;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${draft.value}` },
    });
    testResult.value = r.ok ? `Connected (HTTP ${r.status})` : `Failed (HTTP ${r.status})`;
  } catch (e) {
    testResult.value = `Error: ${(e as Error).message}`;
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <div class="settings-overlay" @click.self="ui.settingsOpen = false">
    <div class="settings-panel">
      <div class="header">
        <h2>Settings</h2>
        <button class="close" @click="ui.settingsOpen = false">✕</button>
      </div>
      <div class="tabs">
        <button :class="['tab', { active: tab === 'api-key' }]" @click="tab = 'api-key'">API Key</button>
        <button :class="['tab', { active: tab === 'models' }]" @click="tab = 'models'" disabled>Models</button>
        <button :class="['tab', { active: tab === 'general' }]" @click="tab = 'general'" disabled>General</button>
      </div>
      <div class="body" v-if="tab === 'api-key'">
        <label>OpenRouter API Key
          <input v-model="draft" placeholder="sk-or-v1-…" type="password">
        </label>
        <p class="hint">Don't have a key? <a href="https://openrouter.ai/" target="_blank">Sign up at OpenRouter →</a></p>
        <div class="actions">
          <button class="btn" :disabled="testing || !draft" @click="onTest">
            {{ testing ? 'Testing…' : 'Test connection' }}
          </button>
          <button class="btn btn-primary" :disabled="!draft" @click="onSave">Save</button>
          <button class="btn btn-danger" :disabled="!settings.apiKeyConfigured" @click="onClear">Clear</button>
        </div>
        <p v-if="testResult" class="result">{{ testResult }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.settings-panel { width: 480px; max-width: 90vw; background: var(--bg-panel); border: 1px solid var(--border-strong); border-radius: 8px; padding: 16px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.header h2 { margin: 0; font-size: 16px; }
.close { background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 16px; }
.tabs { display: flex; gap: 6px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
.tab { padding: 6px 12px; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 12px; }
.tab.active { color: var(--text); border-bottom: 2px solid var(--accent); }
.tab:disabled { opacity: 0.4; cursor: not-allowed; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
input { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; font-family: var(--font-ui); font-size: 13px; }
.hint { font-size: 11px; opacity: 0.7; }
.hint a { color: var(--accent); }
.actions { display: flex; gap: 6px; margin-top: 8px; }
.btn { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border-strong); border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 12px; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
.btn-danger { color: var(--error); }
.result { margin-top: 8px; font-size: 12px; opacity: 0.8; }
</style>
```

- [ ] **Step 2: Create src/components/OnboardingWelcome.vue (3-step flow)**

```vue
<!-- src/components/OnboardingWelcome.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { saveApiKey } from '@/secrets/api-key';
import { useSettingsStore } from '@/stores/settings';

const emit = defineEmits<{ done: [] }>();
const settings = useSettingsStore();
const step = ref(1);
const key = ref('');
const saving = ref(false);

async function next() {
  if (step.value === 2) {
    if (key.value.trim()) {
      saving.value = true;
      try {
        await saveApiKey(key.value.trim());
        settings.setApiKey(key.value.trim());
      } finally {
        saving.value = false;
      }
    }
  }
  step.value++;
}
function skip() { emit('done'); }
function finish() { emit('done'); }
</script>

<template>
  <div class="overlay">
    <div class="welcome">
      <div class="icon">🧪</div>
      <h2>Welcome to Agent Playground</h2>
      <p class="subtitle">Let's get you set up in under a minute.</p>
      <div class="steps">
        <div :class="['dot', { active: step >= 1 }]">1</div>
        <div :class="['dot', { active: step >= 2 }]">2</div>
        <div :class="['dot', { active: step >= 3 }]">3</div>
      </div>

      <section v-if="step === 1">
        <h3>What is this?</h3>
        <p>A node-based playground for building, running, and inspecting AI agents. Wire prompts, tools, and LLM calls visually; see exactly what happens at every step.</p>
        <button class="btn-primary" @click="next">Next →</button>
      </section>

      <section v-else-if="step === 2">
        <h3>Add your OpenRouter API key</h3>
        <p>Free models cost nothing.<br><a href="https://openrouter.ai/" target="_blank">Sign up at OpenRouter (1 minute) →</a></p>
        <input v-model="key" placeholder="sk-or-v1-…" type="password">
        <div class="row">
          <button class="btn" @click="skip">Skip — I'll add later</button>
          <button class="btn-primary" :disabled="saving" @click="next">{{ saving ? 'Saving…' : 'Next →' }}</button>
        </div>
      </section>

      <section v-else>
        <h3>You're all set</h3>
        <p>Templates and a starter graph come in a later release. For now, click + on the canvas to add your first node.</p>
        <button class="btn-primary" @click="finish">Get started</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: var(--bg-canvas); display: flex; align-items: center; justify-content: center; z-index: 3000; }
.welcome { width: 480px; max-width: 90vw; padding: 28px; background: var(--bg-panel); border: 1px solid var(--border-strong); border-radius: 10px; text-align: center; }
.icon { font-size: 36px; margin-bottom: 8px; }
h2 { margin: 0 0 4px; }
.subtitle { opacity: 0.7; font-size: 12px; margin: 0 0 16px; }
.steps { display: flex; justify-content: center; gap: 12px; margin-bottom: 20px; }
.dot { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-elev); color: var(--text-dim); display: flex; align-items: center; justify-content: center; font-size: 12px; }
.dot.active { background: var(--accent); color: white; }
section { display: flex; flex-direction: column; gap: 10px; align-items: center; }
section h3 { margin: 4px 0 0; }
section p { font-size: 13px; opacity: 0.85; margin: 0; }
input { width: 80%; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 6px 10px; font-size: 13px; }
.row { display: flex; gap: 8px; }
.btn, .btn-primary { padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; border: 1px solid var(--border-strong); background: var(--bg-elev); color: var(--text); }
.btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
a { color: var(--accent); }
</style>
```

- [ ] **Step 3: Wire onboarding + Settings into App.vue**

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useGraphStore } from '@/stores/graph';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { pickGraphFileToOpen, pickGraphFileToSave, readGraphFile, writeGraphFile } from '@/persistence/tauri-fs';
import { parseGraph, serializeGraph } from '@/persistence/graph-io';
import { loadApiKey } from '@/secrets/api-key';

import Layout from './components/Layout.vue';
import Settings from './components/Settings.vue';
import OnboardingWelcome from './components/OnboardingWelcome.vue';

const graph = useGraphStore();
const settings = useSettingsStore();
const ui = useUiStore();
const showOnboarding = ref(false);
let unlisten: UnlistenFn | null = null;

async function bootstrap() {
  const key = await loadApiKey();
  settings.setApiKey(key);
  showOnboarding.value = !settings.apiKeyConfigured;
}

async function onNew() { graph.reset(); }
async function onOpen() {
  const path = await pickGraphFileToOpen();
  if (!path) return;
  const text = await readGraphFile(path);
  graph.load(parseGraph(text), path);
}
async function onSave() {
  if (!graph.filePath) return onSaveAs();
  await writeGraphFile(graph.filePath, serializeGraph(graph.graph));
  graph.markSaved(graph.filePath);
}
async function onSaveAs() {
  const path = await pickGraphFileToSave(`${graph.graph.name || 'untitled'}.graph.json`);
  if (!path) return;
  await writeGraphFile(path, serializeGraph(graph.graph));
  graph.markSaved(path);
}

onMounted(async () => {
  await bootstrap();
  unlisten = await listen<string>('menu', async (e) => {
    switch (e.payload) {
      case 'menu.file.new': await onNew(); break;
      case 'menu.file.open': await onOpen(); break;
      case 'menu.file.save': await onSave(); break;
      case 'menu.file.save_as': await onSaveAs(); break;
    }
  });
});
onUnmounted(() => unlisten?.());
</script>

<template>
  <OnboardingWelcome v-if="showOnboarding" @done="showOnboarding = false" />
  <Layout v-else />
  <Settings v-if="ui.settingsOpen" />
</template>
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run tauri dev`
- First launch (clear keychain entry first if needed): onboarding screen appears with steps 1, 2, 3
- Step 2: paste a key, click Next — saves to keychain, advances
- Step 3: click "Get started" — main app appears
- Reload (Cmd+R): goes straight to main app (no onboarding)
- Click ⚙ in toolbar: Settings opens, shows current key (masked); Clear works; reload again brings back onboarding

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Settings page (API Key tab) + 3-step onboarding flow"
```

---

## Task 14: OpenRouter HTTP client with streaming

**Files:**
- Create: `src/openrouter/types.ts`, `src/openrouter/client.ts`, `src/config/default-models.ts`
- Test: `tests/openrouter/client.spec.ts`

- [ ] **Step 1: Create src/openrouter/types.ts**

```ts
// src/openrouter/types.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number | null;
  stream?: boolean;
  response_format?: { type: 'json_object' } | undefined;
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }>;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
}

export interface StreamDelta {
  content?: string;
  tool_calls?: Array<Partial<ToolCall> & { index: number }>;
  role?: string;
}

export interface StreamChunk {
  choices: Array<{ delta: StreamDelta; finish_reason?: string }>;
  usage?: ChatCompletionUsage;
}
```

- [ ] **Step 2: Create src/config/default-models.ts**

```ts
// src/config/default-models.ts
import type { ModelEntry } from '@/stores/settings';

export const DEFAULT_MODELS: ModelEntry[] = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', displayName: 'Llama 3.3 70B (free)', supportsTools: true, supportsJsonMode: true, notes: '' },
  { id: 'deepseek/deepseek-chat-v3:free', displayName: 'DeepSeek Chat v3 (free)', supportsTools: true, supportsJsonMode: true, notes: '' },
  { id: 'google/gemini-2.0-flash-exp:free', displayName: 'Gemini 2.0 Flash (free)', supportsTools: true, supportsJsonMode: false, notes: 'Tool support intermittent on free tier' },
  { id: 'mistralai/mistral-7b-instruct:free', displayName: 'Mistral 7B Instruct (free)', supportsTools: false, supportsJsonMode: false, notes: 'No tool support' },
];
```

- [ ] **Step 3: Write the failing client test**

`tests/openrouter/client.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw';
import { streamChatCompletion } from '@/openrouter/client';

describe('OpenRouter client - streaming', () => {
  it('yields token deltas and final usage', async () => {
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', () => {
        const sse =
          `data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n` +
          `data: {"choices":[{"delta":{"content":" world"}}]}\n\n` +
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n` +
          `data: [DONE]\n\n`;
        return new HttpResponse(sse, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );

    const events: string[] = [];
    let usage: { input: number; output: number } | null = null;
    const text = await streamChatCompletion({
      apiKey: 'k',
      request: { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
      signal: new AbortController().signal,
      onContentDelta: (chunk) => events.push(chunk),
      onUsage: (u) => { usage = u; },
    });

    expect(events).toEqual(['Hello', ' world']);
    expect(text).toBe('Hello world');
    expect(usage).toEqual({ input: 10, output: 5 });
  });

  it('throws on non-2xx', async () => {
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', () =>
        HttpResponse.json({ error: 'rate limited' }, { status: 429 }),
      ),
    );

    await expect(
      streamChatCompletion({
        apiKey: 'k',
        request: { model: 'm', messages: [{ role: 'user', content: 'hi' }] },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/429/);
  });
});
```

- [ ] **Step 4: Run, verify fails**

Run: `npm run test:run -- tests/openrouter/client.spec.ts`
Expected: FAIL.

- [ ] **Step 5: Create src/openrouter/client.ts**

```ts
// src/openrouter/client.ts
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk } from './types';

const BASE = 'https://openrouter.ai/api/v1';

export interface StreamArgs {
  apiKey: string;
  request: ChatCompletionRequest;
  signal: AbortSignal;
  onContentDelta?: (delta: string) => void;
  onUsage?: (usage: { input: number; output: number; cached?: number }) => void;
  onRawChunk?: (chunk: StreamChunk) => void;
}

/**
 * Streams a chat completion. Returns the full assembled assistant text on completion.
 * Throws on non-2xx response or stream error.
 */
export async function streamChatCompletion(args: StreamArgs): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({ ...args.request, stream: true }),
    signal: args.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${body || res.statusText}`);
  }
  if (!res.body) {
    throw new Error('OpenRouter response has no body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let assembled = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
      if (!dataLine) continue;
      const payload = dataLine.slice(6);
      if (payload === '[DONE]') return assembled;
      let chunk: StreamChunk;
      try { chunk = JSON.parse(payload); } catch { continue; }
      args.onRawChunk?.(chunk);
      const choice = chunk.choices?.[0];
      const content = choice?.delta?.content;
      if (typeof content === 'string') {
        assembled += content;
        args.onContentDelta?.(content);
      }
      if (chunk.usage) {
        args.onUsage?.({
          input: chunk.usage.prompt_tokens,
          output: chunk.usage.completion_tokens,
          cached: chunk.usage.prompt_tokens_details?.cached_tokens,
        });
      }
    }
  }
  return assembled;
}

/** Non-streaming convenience for endpoints like /key. */
export async function pingApiKey(apiKey: string): Promise<boolean> {
  const r = await fetch(`${BASE}/key`, { headers: { Authorization: `Bearer ${apiKey}` } });
  return r.ok;
}
```

- [ ] **Step 6: Run tests, verify pass**

Run: `npm run test:run -- tests/openrouter/client.spec.ts`
Expected: 2 pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: OpenRouter streaming client with MSW-tested SSE parsing"
```

---

## Task 15: Execution scheduler — topological traversal

**Files:**
- Create: `src/engine/scheduler.ts`, `src/engine/lifecycle.ts`, `src/engine/abort.ts`
- Test: `tests/engine/scheduler.spec.ts`

- [ ] **Step 1: Write failing scheduler tests**

`tests/engine/scheduler.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { topologicalOrder, validateAcyclic } from '@/engine/scheduler';
import type { Graph } from '@/domain/graph';

function makeGraph(nodeIds: string[], edges: Array<[string, string]>): Graph {
  return {
    schemaVersion: 1, id: 'g', name: 'g',
    createdAt: '', updatedAt: '',
    nodes: nodeIds.map((id) => ({ id, type: 'input', position: { x: 0, y: 0 }, config: {} })),
    edges: edges.map(([s, t], i) => ({ id: `e${i}`, source: s, sourceHandle: 'value', target: t, targetHandle: 'value' })),
    containsCustomCode: false,
  };
}

describe('topologicalOrder', () => {
  it('orders a linear chain', () => {
    const g = makeGraph(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]);
    expect(topologicalOrder(g)).toEqual(['a', 'b', 'c']);
  });

  it('orders parallel branches', () => {
    const g = makeGraph(['a', 'b1', 'b2', 'c'], [['a', 'b1'], ['a', 'b2'], ['b1', 'c'], ['b2', 'c']]);
    const order = topologicalOrder(g);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b1'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b2'));
    expect(order.indexOf('b1')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b2')).toBeLessThan(order.indexOf('c'));
  });

  it('throws on a cycle', () => {
    const g = makeGraph(['a', 'b'], [['a', 'b'], ['b', 'a']]);
    expect(() => topologicalOrder(g)).toThrow(/cycle/i);
  });
});

describe('validateAcyclic', () => {
  it('passes on a DAG', () => {
    const g = makeGraph(['a', 'b'], [['a', 'b']]);
    expect(() => validateAcyclic(g)).not.toThrow();
  });

  it('throws on a self-loop', () => {
    const g = makeGraph(['a'], [['a', 'a']]);
    expect(() => validateAcyclic(g)).toThrow(/cycle/i);
  });
});
```

- [ ] **Step 2: Run, verify fails**

Run: `npm run test:run -- tests/engine/scheduler.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create src/engine/scheduler.ts**

```ts
// src/engine/scheduler.ts
import type { Graph } from '@/domain/graph';

/**
 * Returns a topological ordering of node ids. Throws if the graph contains a cycle.
 * Plan 1 has no Loop Controller; cycles are not yet allowed (loops are added in Plan 3).
 */
export function topologicalOrder(graph: Graph): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of graph.edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, d] of inDegree) if (d === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (order.length !== graph.nodes.length) {
    throw new Error('Graph contains a cycle (Loop Controller support is added in Plan 3)');
  }
  return order;
}

export function validateAcyclic(graph: Graph): void {
  topologicalOrder(graph);
}

/**
 * Returns a map from nodeId → list of incoming edges, useful for building per-node input objects.
 */
export function incomingEdges(graph: Graph): Map<string, Graph['edges']> {
  const m = new Map<string, Graph['edges']>();
  for (const n of graph.nodes) m.set(n.id, []);
  for (const e of graph.edges) m.get(e.target)?.push(e);
  return m;
}
```

- [ ] **Step 4: Create src/engine/lifecycle.ts**

```ts
// src/engine/lifecycle.ts
import type { NodeStatus } from '@/domain/run';

export const TERMINAL: ReadonlySet<NodeStatus> = new Set(['done', 'error']);

export function canTransition(from: NodeStatus, to: NodeStatus): boolean {
  if (from === 'idle') return to === 'running' || to === 'error';
  if (from === 'running') return to === 'streaming' || to === 'done' || to === 'error';
  if (from === 'streaming') return to === 'done' || to === 'error';
  return false;
}
```

- [ ] **Step 5: Create src/engine/abort.ts**

```ts
// src/engine/abort.ts
let current: AbortController | null = null;

export function newRunAbortController(): AbortController {
  current?.abort();
  current = new AbortController();
  return current;
}

export function getCurrent(): AbortController | null {
  return current;
}

export function abortCurrent() {
  current?.abort();
}
```

- [ ] **Step 6: Run tests, verify pass**

Run: `npm run test:run -- tests/engine/scheduler.spec.ts`
Expected: 5 pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: execution scheduler (topological order, cycle detection)"
```

---

## Task 16: Execution runner — wires nodes' run() into the scheduler

**Files:**
- Create: `src/engine/runner.ts`
- Test: `tests/engine/runner.spec.ts`
- Modify: `src/components/Toolbar.vue`, `src/App.vue`

The runner ties everything together: it walks the topo order, gathers each node's inputs from upstream outputs, calls the node definition's `run()`, and updates the run store.

- [ ] **Step 1: Write failing runner test (Input → Output)**

`tests/engine/runner.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { runGraph } from '@/engine/runner';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { Graph } from '@/domain/graph';

// Importing the node modules registers them
import '@/nodes/input';
import '@/nodes/output';

describe('runGraph (Input → Output)', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('runs a simple Input → Output graph', async () => {
    const graph: Graph = {
      schemaVersion: 1, id: 'g', name: 'g',
      createdAt: '', updatedAt: '',
      nodes: [
        { id: 'a', type: 'input', position: { x: 0, y: 0 }, config: { name: 'q', valueType: 'text', defaultValue: 'hello' } },
        { id: 'b', type: 'output', position: { x: 0, y: 0 }, config: { format: 'auto' } },
      ],
      edges: [{ id: 'e', source: 'a', sourceHandle: 'value', target: 'b', targetHandle: 'value' }],
      containsCustomCode: false,
    };

    const graphStore = useGraphStore();
    graphStore.load(graph, '/tmp/x.graph.json');

    await runGraph({ graph, apiKey: '' });

    const runStore = useRunStore();
    expect(runStore.current?.status).toBe('completed');
    expect(runStore.current?.nodeResults['b']?.details.value).toBe('hello');
  });
});
```

- [ ] **Step 2: Run, verify fails**

Run: `npm run test:run -- tests/engine/runner.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create src/engine/runner.ts**

```ts
// src/engine/runner.ts
import type { Graph } from '@/domain/graph';
import type { Run, NodeResult } from '@/domain/run';
import { topologicalOrder, incomingEdges } from './scheduler';
import { getNodeDefinition } from '@/nodes/registry';
import { useRunStore } from '@/stores/run';
import { newRunAbortController } from './abort';

export interface RunGraphArgs {
  graph: Graph;
  apiKey: string;
  /** Optional per-node overrides, e.g. for streaming callbacks from the UI. */
  perNode?: Record<string, { onStreamUpdate?: (preview: string) => void }>;
}

export async function runGraph(args: RunGraphArgs): Promise<Run> {
  const runStore = useRunStore();
  const controller = newRunAbortController();

  const run: Run = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    graphId: args.graph.id,
    graphSnapshot: structuredClone(args.graph),
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'running',
    inputs: {},
    nodeResults: {},
    errors: [],
  };
  for (const node of args.graph.nodes) {
    run.nodeResults[node.id] = { nodeId: node.id, status: 'idle', details: {} };
  }
  runStore.start(run);

  const order = topologicalOrder(args.graph);
  const incoming = incomingEdges(args.graph);
  const outputsByNode = new Map<string, Record<string, unknown>>();

  try {
    for (const id of order) {
      if (controller.signal.aborted) {
        run.status = 'aborted';
        break;
      }
      const node = args.graph.nodes.find((n) => n.id === id)!;
      const def = getNodeDefinition(node.type);
      if (!def) {
        throw new Error(`No definition registered for node type "${node.type}"`);
      }

      // Build inputs from upstream outputs
      const inputs: Record<string, unknown> = {};
      for (const edge of incoming.get(id) ?? []) {
        const sourceOutputs = outputsByNode.get(edge.source) ?? {};
        inputs[edge.targetHandle] = sourceOutputs[edge.sourceHandle];
      }

      // Update store: running
      const result: NodeResult = run.nodeResults[id];
      result.status = 'running';
      result.startedAt = new Date().toISOString();
      runStore.recordResult(result);

      try {
        const ctx = {
          signal: controller.signal,
          details: result.details,
          onStreamUpdate: args.perNode?.[id]?.onStreamUpdate,
          apiKey: args.apiKey,
        };
        const outputs = await def.run(node, inputs, ctx);
        outputsByNode.set(id, outputs);
        result.output = outputs;
        result.status = 'done';
        result.endedAt = new Date().toISOString();
        runStore.recordResult(result);
      } catch (e) {
        result.status = 'error';
        result.endedAt = new Date().toISOString();
        result.errorMessage = (e as Error).message;
        result.errorStack = (e as Error).stack;
        runStore.recordResult(result);
        run.errors.push({ nodeId: id, message: (e as Error).message, stack: (e as Error).stack });
        run.status = 'failed';
        throw e;
      }
    }
    if (run.status === 'running') run.status = 'completed';
  } catch {
    // already recorded above
  } finally {
    runStore.finish(run.status);
  }
  return run;
}
```

Note the runner extends the `NodeRunContext` with `apiKey`. Update `src/nodes/registry.ts` to include it:

```ts
// src/nodes/registry.ts (extend NodeRunContext)
export interface NodeRunContext {
  signal: AbortSignal;
  details: Record<string, unknown>;
  onStreamUpdate?: (preview: string) => void;
  apiKey: string;  // NEW
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test:run -- tests/engine/runner.spec.ts`
Expected: 1 passes.

- [ ] **Step 5: Wire Run/Stop buttons in Toolbar.vue**

```vue
<script setup lang="ts">
// add to existing imports
import { runGraph } from '@/engine/runner';
import { abortCurrent } from '@/engine/abort';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();

async function onRun() {
  if (!settings.apiKeyConfigured) {
    alert('Add an OpenRouter API key in Settings first.');
    return;
  }
  await runGraph({ graph: graph.graph, apiKey: settings.apiKey ?? '' });
}
function onStop() { abortCurrent(); }
</script>
```

- [ ] **Step 6: Tick the elapsed timer during runs**

In `App.vue` add a `requestAnimationFrame` loop driven from `useRunStore.tick()`:

```ts
// inside the existing <script setup> in App.vue
import { useRunStore } from '@/stores/run';
const run = useRunStore();
function rafLoop() {
  run.tick();
  requestAnimationFrame(rafLoop);
}
onMounted(() => requestAnimationFrame(rafLoop));
```

- [ ] **Step 7: Manual smoke test**

Run: `npm run tauri dev`
- Build a graph: Input ("hello world") → Output
- Click Run
- Output node card should show "hello world"
- Inspector on Output should show the value
- Toolbar: total tokens stay at 0 (no LLM in this graph), elapsed shows ~0ms, Run button briefly disabled, freezes on completion

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: execution runner (topological run with per-node lifecycle, abort, run store)"
```

---

## Task 17: LLM Call node — definition, run() with streaming

**Files:**
- Create: `src/nodes/llm-call.ts`, `src/components/nodes/LLMCallNode.vue`, `src/components/inspectors/LLMCallInspector.vue`
- Test: `tests/nodes/llm-call.spec.ts`
- Modify: `src/components/Canvas.vue`, `src/components/Inspector.vue`, `src/main.ts`

- [ ] **Step 1: Write the failing LLM Call test (with MSW)**

`tests/nodes/llm-call.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw';
import { llmCallNode } from '@/nodes/llm-call';
import type { Node } from '@/domain/graph';

describe('llm-call node', () => {
  it('calls OpenRouter, streams content, records details', async () => {
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', () => {
        const sse =
          `data: {"choices":[{"delta":{"content":"Paris"}}]}\n\n` +
          `data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}\n\n` +
          `data: [DONE]\n\n`;
        return new HttpResponse(sse, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );

    const node: Node = {
      id: 'l', type: 'llm-call', position: { x: 0, y: 0 },
      config: {
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        systemPrompt: 'Be concise.',
        temperature: 0.7, maxTokens: null, responseFormat: null,
      },
    };
    const ctx = { signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: 'test-key' };
    const out = await llmCallNode.run(node, { userMessage: 'capital of France?' }, ctx);

    expect(out.text).toBe('Paris');
    expect(out.usage).toEqual({ input: 3, output: 1 });
    expect(ctx.details.request).toBeDefined();
    expect(ctx.details.timing).toBeDefined();
  });
});
```

- [ ] **Step 2: Run, verify fails**

Run: `npm run test:run -- tests/nodes/llm-call.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create src/nodes/llm-call.ts**

```ts
// src/nodes/llm-call.ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LLMCallConfig } from '@/domain/node-types';
import { streamChatCompletion } from '@/openrouter/client';
import type { ChatMessage } from '@/openrouter/types';
import { useRunStore } from '@/stores/run';

function buildMessages(cfg: LLMCallConfig, inputs: Record<string, unknown>): ChatMessage[] {
  const upstream = inputs.messages;
  if (Array.isArray(upstream)) {
    // Insert system message at the front if specified and not already present
    if (cfg.systemPrompt && upstream[0]?.role !== 'system') {
      return [{ role: 'system', content: cfg.systemPrompt }, ...(upstream as ChatMessage[])];
    }
    return upstream as ChatMessage[];
  }
  const userMessage = typeof inputs.userMessage === 'string' ? inputs.userMessage : '';
  const messages: ChatMessage[] = [];
  if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });
  if (userMessage) messages.push({ role: 'user', content: userMessage });
  return messages;
}

export const llmCallNode: NodeDefinition = {
  type: 'llm-call',
  inputPorts: ['messages', 'userMessage', 'tools'],
  outputPorts: ['text', 'toolCalls', 'messages', 'usage'],
  async run(node, inputs, ctx) {
    const cfg = node.config as LLMCallConfig;
    const messages = buildMessages(cfg, inputs);

    const request = {
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens ?? undefined,
      response_format: cfg.responseFormat === 'json_object' ? { type: 'json_object' as const } : undefined,
    };
    ctx.details.request = request;

    const t0 = performance.now();
    let assembled = '';
    let usage = { input: 0, output: 0 };
    let firstTokenAtMs: number | null = null;

    const text = await streamChatCompletion({
      apiKey: ctx.apiKey,
      request,
      signal: ctx.signal,
      onContentDelta: (chunk) => {
        if (firstTokenAtMs === null) firstTokenAtMs = performance.now() - t0;
        assembled += chunk;
        const preview = assembled.length > 80 ? `…${assembled.slice(-80)}` : assembled;
        ctx.onStreamUpdate?.(preview);
      },
      onUsage: (u) => {
        usage = { input: u.input, output: u.output };
        useRunStore().addTokens(u.input, u.output);
      },
    });

    const totalMs = performance.now() - t0;
    ctx.details.response = { text };
    ctx.details.usage = usage;
    ctx.details.timing = { totalMs, firstTokenMs: firstTokenAtMs };

    const finalMessages: ChatMessage[] = [...messages, { role: 'assistant', content: text }];
    return { text, toolCalls: [], messages: finalMessages, usage };
  },
};

registerNodeDefinition(llmCallNode);
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test:run -- tests/nodes/llm-call.spec.ts`
Expected: 1 passes.

- [ ] **Step 5: Create src/components/nodes/LLMCallNode.vue**

```vue
<!-- src/components/nodes/LLMCallNode.vue -->
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed, ref, watch } from 'vue';
import { useRunStore } from '@/stores/run';

const props = defineProps<{ id: string; data: { config: { model: string } } }>();
const run = useRunStore();

const result = computed(() => run.current?.nodeResults[props.id]);
const livePreview = ref<string | null>(null);

const status = computed(() => result.value?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#888';
  }
});
const tokens = computed(() => {
  const u = result.value?.details?.usage as { input: number; output: number } | undefined;
  return u ? u.input + u.output : null;
});
const previewText = computed(() => {
  if (livePreview.value) return livePreview.value;
  const v = result.value?.details?.response as { text?: string } | undefined;
  if (v?.text) {
    return v.text.length > 80 ? `${v.text.slice(0, 80)}…` : v.text;
  }
  if (status.value === 'error') return result.value?.errorMessage ?? 'error';
  return '— not yet run —';
});

watch(() => result.value?.status, (s) => {
  if (s !== 'running' && s !== 'streaming') livePreview.value = null;
});

defineExpose({ setLivePreview: (s: string) => { livePreview.value = s; } });
</script>

<template>
  <div class="node-card llm-card" :style="{ borderColor }">
    <div class="header">
      <strong>LLM Call</strong>
      <div class="sub">{{ data.config.model }}</div>
      <span v-if="tokens !== null" class="badge">{{ tokens }} tok</span>
    </div>
    <div class="body">{{ previewText }}</div>
    <Handle id="messages" type="target" :position="Position.Left" :style="{ top: '40%' }" />
    <Handle id="userMessage" type="target" :position="Position.Left" :style="{ top: '60%' }" />
    <Handle id="text" type="source" :position="Position.Right" :style="{ top: '40%' }" />
    <Handle id="messages" type="source" :position="Position.Right" :style="{ top: '60%' }" />
  </div>
</template>

<style scoped>
.node-card { width: 220px; background: var(--bg-panel-strong); border: 2px solid #888; border-radius: 8px; overflow: hidden; }
.header { padding: 8px 10px; background: var(--bg-elev); border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; position: relative; }
.sub { opacity: 0.6; font-size: 10px; }
.badge { position: absolute; right: 8px; top: 8px; font-size: 9px; background: #1f3d1f; color: #8fd58f; padding: 1px 5px; border-radius: 3px; }
.body { padding: 8px 10px; min-height: 38px; font-size: 11px; opacity: 0.9; }
</style>
```

- [ ] **Step 6: Create src/components/inspectors/LLMCallInspector.vue with collapsible sections**

```vue
<!-- src/components/inspectors/LLMCallInspector.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import type { LLMCallConfig } from '@/domain/node-types';
import { DEFAULT_MODELS } from '@/config/default-models';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();
const settings = useSettingsStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as LLMCallConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);

const sectionsOpen = ref({
  config: true, conversation: true, stats: true,
  request: false, response: false, errors: false,
});

const modelOptions = computed(() =>
  settings.models.length > 0 ? settings.models : DEFAULT_MODELS,
);

function update<K extends keyof LLMCallConfig>(key: K, value: LLMCallConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
function toggle(k: keyof typeof sectionsOpen.value) { sectionsOpen.value[k] = !sectionsOpen.value[k]; }

const messages = computed(() => {
  const req = result.value?.details?.request as { messages?: Array<{ role: string; content: string }> } | undefined;
  return req?.messages ?? [];
});
const usage = computed(() => result.value?.details?.usage as { input: number; output: number } | undefined);
const timing = computed(() => result.value?.details?.timing as { totalMs: number; firstTokenMs: number | null } | undefined);
</script>

<template>
  <div v-if="cfg">
    <section>
      <h4 @click="toggle('config')">{{ sectionsOpen.config ? '▼' : '▶' }} Config</h4>
      <div v-show="sectionsOpen.config" class="form">
        <label>Model
          <select :value="cfg.model" @change="(e) => update('model', (e.target as HTMLSelectElement).value)">
            <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.displayName }}</option>
          </select>
        </label>
        <label>System prompt
          <textarea :value="cfg.systemPrompt" @input="(e) => update('systemPrompt', (e.target as HTMLTextAreaElement).value)" rows="3"></textarea>
        </label>
        <label>Temperature
          <input type="number" min="0" max="2" step="0.1" :value="cfg.temperature" @input="(e) => update('temperature', parseFloat((e.target as HTMLInputElement).value))">
        </label>
      </div>
    </section>

    <section>
      <h4 @click="toggle('conversation')">{{ sectionsOpen.conversation ? '▼' : '▶' }} Conversation</h4>
      <div v-show="sectionsOpen.conversation" class="conversation">
        <div v-for="(m, i) in messages" :key="i" class="msg" :data-role="m.role">
          <div class="role">{{ m.role }}</div>
          <pre>{{ m.content }}</pre>
        </div>
        <div v-if="result?.details?.response" class="msg" data-role="assistant">
          <div class="role">assistant</div>
          <pre>{{ (result.details.response as { text: string }).text }}</pre>
        </div>
      </div>
    </section>

    <section>
      <h4 @click="toggle('stats')">{{ sectionsOpen.stats ? '▼' : '▶' }} Stats</h4>
      <div v-show="sectionsOpen.stats" class="stats">
        <div>tokens in: <strong>{{ usage?.input ?? '—' }}</strong></div>
        <div>tokens out: <strong>{{ usage?.output ?? '—' }}</strong></div>
        <div>total time: <strong>{{ timing ? `${(timing.totalMs / 1000).toFixed(2)}s` : '—' }}</strong></div>
        <div>first token: <strong>{{ timing?.firstTokenMs !== null ? `${Math.round(timing.firstTokenMs)}ms` : '—' }}</strong></div>
      </div>
    </section>

    <section>
      <h4 @click="toggle('request')">{{ sectionsOpen.request ? '▼' : '▶' }} Raw request</h4>
      <pre v-show="sectionsOpen.request" class="raw">{{ result?.details?.request ?? '—' }}</pre>
    </section>

    <section>
      <h4 @click="toggle('response')">{{ sectionsOpen.response ? '▼' : '▶' }} Raw response</h4>
      <pre v-show="sectionsOpen.response" class="raw">{{ result?.details?.response ?? '—' }}</pre>
    </section>

    <section v-if="result?.errorMessage">
      <h4 @click="toggle('errors')" class="error-head">{{ sectionsOpen.errors ? '▼' : '▶' }} Error</h4>
      <pre v-show="sectionsOpen.errors" class="raw error">{{ result.errorMessage }}{{ result.errorStack ? '\n\n' + result.errorStack : '' }}</pre>
    </section>
  </div>
</template>

<style scoped>
section { border-top: 1px solid var(--border); }
section:first-child { border-top: none; }
h4 { margin: 0; padding: 8px 0; font-size: 12px; cursor: pointer; user-select: none; }
.form { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 12px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; opacity: 0.85; }
input, select, textarea { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 12px; font-family: var(--font-ui); }
.conversation { padding-bottom: 12px; }
.msg { margin: 6px 0; padding: 6px 8px; background: var(--bg-panel); border-radius: 4px; }
.msg .role { font-size: 10px; opacity: 0.5; text-transform: uppercase; margin-bottom: 2px; }
.msg pre { margin: 0; white-space: pre-wrap; font-size: 11px; }
.msg[data-role="assistant"] pre { color: #b8d8ff; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; padding: 4px 0 12px; font-size: 11px; }
.raw { background: var(--bg-panel); padding: 6px 8px; border-radius: 4px; font-size: 11px; max-height: 200px; overflow: auto; white-space: pre-wrap; }
.raw.error { color: #f5a5a5; }
.error-head { color: var(--error); }
</style>
```

- [ ] **Step 7: Wire LLMCallNode + LLMCallInspector into Canvas.vue and Inspector.vue**

Canvas.vue — extend `nodeTypes`:

```ts
import LLMCallNode from './nodes/LLMCallNode.vue';
const nodeTypes = { input: InputNode, output: OutputNode, 'llm-call': LLMCallNode };
```

Inspector.vue — extend type switch:

```vue
<div v-else-if="selectedNode.type === 'llm-call'"><LLMCallInspector :nodeId="selectedNode.id" /></div>
```

…and import.

- [ ] **Step 8: Eagerly import node modules so registrations happen**

In `src/main.ts`:

```ts
// Force registration of node definitions
import '@/nodes/input';
import '@/nodes/output';
import '@/nodes/llm-call';
```

- [ ] **Step 9: Plumb live streaming preview from runner → node card**

This is the trickiest piece. Approach: the `runGraph` accepts `perNode` callbacks, and the node card subscribes via the run store. Simpler approach: the run store gets a per-node `livePreview` map.

Add to `src/stores/run.ts`:

```ts
const livePreviews = ref<Record<string, string>>({});
function setLivePreview(nodeId: string, preview: string) { livePreviews.value[nodeId] = preview; }
function clearLivePreviews() { livePreviews.value = {}; }
// add to return: livePreviews, setLivePreview, clearLivePreviews
```

Update `start()` to call `clearLivePreviews()`.

Update `LLMCallNode.vue` to use `run.livePreviews[id]` instead of the local `ref`:

```ts
const livePreview = computed(() => run.livePreviews[props.id]);
```

…delete the `defineExpose({ setLivePreview })` line.

Update `runGraph` to wire `onStreamUpdate`:

In `src/engine/runner.ts`, replace the `ctx` construction:

```ts
const ctx = {
  signal: controller.signal,
  details: result.details,
  onStreamUpdate: (preview: string) => runStore.setLivePreview(id, preview),
  apiKey: args.apiKey,
};
```

- [ ] **Step 10: Manual smoke test — full flow**

Run: `npm run tauri dev`
- (Requires a real API key configured — and a free model that is currently up.)
- Build: Input ("What's the capital of France?") → LLM Call (model: llama-3.3-70b-instruct:free, system prompt: "Be concise.") → Output
  - Wire Input.value → LLM Call.userMessage
  - Wire LLM Call.text → Output.value
- Click ▶ Run
- Expected: LLM Call node card border turns blue, response streams onto the card live, finishes green, Output shows "Paris" (or similar). Toolbar shows token in/out tick up; elapsed shows ~1-3s.
- Click LLM Call node — Inspector shows Conversation, Stats (tokens, timing), expandable raw request/response.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: LLM Call node — streaming, inspector with collapsible sections, live preview"
```

---

## Task 18: End-to-end verification, polish, README

**Files:**
- Create: `README.md`
- Modify: as needed for cleanups

- [ ] **Step 1: Run full type and test pass**

```bash
npm run typecheck
npm run test:run
```

Expected: 0 type errors, all tests pass.

- [ ] **Step 2: Verify the "happy path" template manually**

Run: `npm run tauri dev`
Build the smallest interesting graph: `Input → LLM Call → Output` with a real API key. Save it to a file. Close the app. Reopen — graph loads. Run again. Result matches.

- [ ] **Step 3: Write a minimal README.md**

```markdown
# Agent Playground

A node-based AI agent playground for building, running, and inspecting AI agents.

## Status

Plan 1 (Foundation) — runnable. You can wire `Input → LLM Call → Output` and stream a response from a free OpenRouter model.

Subsequent plans add: tools (Plan 2), loops & agent encapsulation (Plan 3), chat sidebar & templates (Plan 4).

## Setup

Prerequisites: Rust toolchain (`rustup`), Node.js 20+, Xcode CLT (mac), an OpenRouter API key.

```bash
npm install
npm run tauri dev
```

On first launch, paste your OpenRouter API key into the welcome screen.

## Tests

```bash
npm run test:run     # one-shot
npm run test         # watch mode
npm run typecheck
```

## Documentation

- Design spec: `docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md`
- Implementation plans: `docs/plans/`
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README for Plan 1 foundation milestone"
```

---

## Self-Review Checklist

Before declaring Plan 1 done, run through this:

**Spec coverage (against design spec sections):**

- [ ] **Section 1 Goal** — covered: end state is `Input → LLM Call → Output` with full inspection
- [ ] **Section 4 Tech Stack** — Tauri 2 ✓, Vue 3 + TS + Vite ✓, Pinia ✓, Vue Flow ✓, Vitest ✓, MSW ✓, zod ✓, keychain ✓, fs+dialog ✓. Monaco installed but unused (Plan 2). Stronghold replaced by `keyring` crate (documented).
- [ ] **Section 5 Domain model** — Graph, Node, Edge, Run, NodeResult, IterationRecord all defined. NodeType union includes all 13 types even though only 3 are implemented.
- [ ] **Section 6.1 Input, 6.2 Output, 6.3 LLM Call** — implemented. Other node types intentionally deferred to later plans.
- [ ] **Section 7 Execution model** — topological traversal ✓, AND-semantics ✓, idle/running/streaming/done/error lifecycle ✓, streaming ✓, errors ✓, abort ✓. Cycles rejected (Loop Controller is Plan 3).
- [ ] **Section 8.1 LLM Call Inspector** — covered: Request, Response, Conversation, Tokens, Timing in Plan 1. Stream playback, HTTP details, Cost, Tool calls deferred (the Stream section in spec is more elaborate; Plan 1 ships the live token-stream-onto-card and a basic raw-request/response viewer; the timeline-replay UI can come in a later plan).
- [ ] **Section 9 Chat Sidebar** — placeholder only ("Not a chat graph"). Plan 4.
- [ ] **Section 10 Persistence** — graph save/load ✓; run files (`*.runs/*.json`) deferred to Plan 2.
- [ ] **Section 12.1 API Key Settings** — covered.
- [ ] **Section 12.2 Models tab** — disabled tab in Plan 1, default model list shipped in `default-models.ts`.
- [ ] **Section 18 UI decisions** — Layout A ✓, Node cards B (informative, with token badge & preview) ✓, Inspector B (collapsible accordion) ✓, Add-node UX C (palette + right-click + ⌘K) ✓, Toolbar A (native menu + minimal in-window with live token in/out + run timer) ✓, Onboarding B (3-step welcome) ✓, Empty states A (minimal "Not a chat graph", "No runs yet") ✓.
- [ ] **Section 19 Phasing** — Plan 1 covers spec phases 1-2.

**Placeholder scan:** confirmed no "TBD", "TODO", "implement later", "similar to Task N", or vague handwaving in any task body.

**Type consistency:** `NodeRunContext` has `apiKey: string` (added in Task 16, used in Tasks 16 + 17). All node `run()` signatures match the registry's `NodeDefinition` interface. `Graph` and `Node` interfaces are imported consistently from `@/domain/graph`. Run store's `livePreviews` (added in Task 17 step 9) matches the LLM Call node's usage.

If any boxes above are unchecked when you complete the plan, address them before declaring done.
