# Plan 4 — Chat & Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the data-shaping nodes (Transform, Prompt Template), the chat-mode nodes (Chat Input, Chat Output), the chat sidebar that turns a graph into an interactive chat, and a bundled-templates menu — completing the original design spec.

**Architecture:** Two thin compute nodes (Transform, Prompt Template) follow the same `NodeDefinition` pattern as everything else and dynamic-port semantics already pioneered by the Loop Controller for Prompt Template's `{{var}}` ports. Chat Input/Output are sentinel node types that the chat sidebar discovers and binds to: per-submission, the sidebar appends to an in-memory thread, calls `runGraph` with a `chatSession` arg the runner threads into Chat Input's `run()`, and then reads Chat Output's recorded value to render the assistant reply. Templates are JSON files bundled under `src/templates/` and surfaced via a "New from Template" toolbar action.

**Tech Stack:** TypeScript strict, Vue 3 + Composition API + `<script setup>`, Pinia, Vue Flow, Vitest. The Monaco editor wrapper from Plan 2 is reused for the Prompt Template's template field. Tailwind CSS v4 for all styling.

---

## File Structure

**New engine files**
- `src/nodes/transform.ts` — Transform node definition (5 modes)
- `src/nodes/prompt-template.ts` — Prompt Template node with dynamic input ports
- `src/nodes/chat-input.ts` — Chat Input node (reads run-time `ctx.chatSession`)
- `src/nodes/chat-output.ts` — Chat Output node (records `text` to `details.value`)

**New shared utility**
- `src/nodes/_internals/template-vars.ts` — `extractPlaceholders(template)` + `renderTemplate(template, values)`. Used by Prompt Template AND Transform's `template` mode so there's only one regex.

**New UI files**
- `src/components/nodes/TransformNode.vue`
- `src/components/inspectors/TransformInspector.vue`
- `src/components/nodes/PromptTemplateNode.vue`
- `src/components/inspectors/PromptTemplateInspector.vue`
- `src/components/nodes/ChatInputNode.vue`
- `src/components/inspectors/ChatInputInspector.vue`
- `src/components/nodes/ChatOutputNode.vue`
- `src/components/inspectors/ChatOutputInspector.vue`
- `src/components/chat/ChatPanel.vue` — the active chat thread + input box
- `src/components/chat/ChatBubble.vue` — single user/assistant message bubble (markdown render)
- `src/components/TemplatePickerModal.vue` — "New from Template" modal

**New state / persistence**
- `src/stores/chat.ts` — `useChatStore`: in-memory thread, current-turn status, submit handler
- `src/templates/index.ts` — exports a typed list of bundled templates (id, name, description, graph JSON)
- `src/templates/data/01-hello-model.graph.json` — bundled template
- `src/templates/data/02-two-model-comparison.graph.json` — bundled template
- `src/templates/data/03-self-critique-fixed.graph.json` — bundled template (fixed-N refinement)
- `src/templates/data/04-rag-lite.graph.json` — bundled template
- `src/templates/data/05-raw-react-chat.graph.json` — bundled template
- `src/templates/data/06-encapsulated-agent-chat.graph.json` — bundled template

**Modified files**
- `src/domain/node-types.ts` — add `TransformConfig`, `PromptTemplateConfig`, `ChatInputConfig`, `ChatOutputConfig` to the `NodeConfig` union
- `src/engine/runner.ts` — accept optional `chatSession` in `RunGraphArgs` and forward to per-node `ctx`
- `src/nodes/registry.ts` — extend `NodeRunContext` with `chatSession?: ChatSession`
- `src/nodes/port-types.ts` — add Transform / Prompt Template / Chat Input / Chat Output port resolvers (Prompt Template's input ports are dynamic per `{{var}}`)
- `src/components/Canvas.vue` — register four new node Vue components in `nodeTypes`
- `src/components/AddNodeMenu.vue` — append four menu entries + default configs (Chat Input/Output excluded from menu — added via toolbar/template only? See Task 6: keep them in menu for parity, but warn if a graph has more than one)
- `src/components/Inspector.vue` — wire the four new inspectors
- `src/components/LeftTabs.vue` — replace the "Not a chat graph" placeholder with `<ChatPanel />` when chat is active
- `src/components/Toolbar.vue` — add "New from Template" button that opens `TemplatePickerModal`
- `src/main.ts` — add four `import '@/nodes/<name>';` self-registers
- `graphs/test3-self-critique.graph.json` — rewrite once Transform exists, using `responseFormat: 'json_object'` + a Transform that parses `{good, critique}` and emits `!good` as continue. Halts on the critic's verdict, not on max-iter.

**New test files**
- `tests/nodes/transform.spec.ts` — unit tests for each of the 5 modes
- `tests/nodes/prompt-template.spec.ts` — placeholder discovery + rendering
- `tests/nodes/template-vars.spec.ts` — `extractPlaceholders` + `renderTemplate` round-trip
- `tests/nodes/chat-nodes.spec.ts` — Chat Input reads `ctx.chatSession`; Chat Output records `text` to details
- `tests/stores/chat.spec.ts` — submit flow against a stub runGraph; thread shape

---

## Glossary (consistent across tasks)

- **Placeholder syntax:** `{{name}}` — exactly two opening braces, then a name `[A-Za-z_][A-Za-z0-9_]*`, then exactly two closing braces. Whitespace inside the braces (`{{ name }}`) is allowed and trimmed.
- **`ChatSession`:** `{ userMessage: string; history: ChatMessage[] }`. The history INCLUDES the latest user message at index `length - 1`.
- **`ChatThread`:** the chat sidebar's own in-memory state, separate from `ChatSession`. Shape: `{ messages: Array<{ role: 'user' | 'assistant'; content: string }>; status: 'idle' | 'running' }`.
- **Chat-active graph:** a graph that contains exactly one `chat-input` node AND exactly one `chat-output` node. Anything else (zero, more than one of either) → chat sidebar shows the placeholder.

---

## Task 1: Shared template-vars helper (TDD)

**Files:**
- Create: `src/nodes/_internals/template-vars.ts`
- Create: `tests/nodes/template-vars.spec.ts`

This is reused by Prompt Template AND Transform's `template` mode, so build it once and test it directly.

- [ ] **Step 1: Write failing tests**

Create `tests/nodes/template-vars.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractPlaceholders, renderTemplate } from '@/nodes/_internals/template-vars';

describe('extractPlaceholders', () => {
  it('returns [] for a template with no placeholders', () => {
    expect(extractPlaceholders('plain text')).toEqual([]);
  });

  it('finds a single placeholder', () => {
    expect(extractPlaceholders('Hello {{name}}!')).toEqual(['name']);
  });

  it('finds multiple distinct placeholders preserving first-seen order', () => {
    expect(extractPlaceholders('{{a}} then {{b}} then {{a}}')).toEqual(['a', 'b']);
  });

  it('trims whitespace inside braces', () => {
    expect(extractPlaceholders('Hello {{  name  }}')).toEqual(['name']);
  });

  it('ignores malformed braces', () => {
    expect(extractPlaceholders('{name} {{ }} {{1bad}} {{good}}')).toEqual(['good']);
  });
});

describe('renderTemplate', () => {
  it('substitutes values for placeholders', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'world' })).toBe('Hello world!');
  });

  it('substitutes multiple placeholders', () => {
    expect(renderTemplate('{{greet}}, {{name}}', { greet: 'Hi', name: 'Ada' }))
      .toBe('Hi, Ada');
  });

  it('coerces non-string values to JSON strings', () => {
    expect(renderTemplate('total = {{n}}', { n: 42 })).toBe('total = 42');
    expect(renderTemplate('list = {{x}}', { x: [1, 2, 3] })).toBe('list = [1,2,3]');
  });

  it('replaces missing placeholders with an empty string', () => {
    expect(renderTemplate('Hi {{missing}}!', {})).toBe('Hi !');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd /Users/matjazfikfak/PhpstormProjects/agent_playground && npm run test:run -- tests/nodes/template-vars.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/nodes/_internals/template-vars.ts`:

```ts
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * Returns the unique placeholder names appearing in `template`, in first-seen order.
 * Whitespace inside braces is allowed and trimmed. Names must match
 * `[A-Za-z_][A-Za-z0-9_]*`; anything else is silently ignored.
 */
export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/**
 * Replaces each `{{name}}` with `values[name]`. Strings are inserted verbatim.
 * Non-string values are JSON-stringified (so a number renders as `42`, an array
 * as `[1,2,3]`). Missing keys substitute the empty string.
 */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER_RE, (_full, name: string) => {
    if (!(name in values)) return '';
    const v = values[name];
    if (typeof v === 'string') return v;
    if (v === null || v === undefined) return '';
    try { return JSON.stringify(v); } catch { return String(v); }
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test:run -- tests/nodes/template-vars.spec.ts`
Expected: PASS (9 tests).

Run full suite: `npm run test:run`
Expected: 70 passing (61 prior + 9 new).

- [ ] **Step 5: Commit**

```bash
git add src/nodes/_internals/template-vars.ts tests/nodes/template-vars.spec.ts
git commit -m "feat(internals): template-vars helper for {{var}} extract + render"
```

---

## Task 2: Transform node — engine + tests

**Files:**
- Create: `src/nodes/transform.ts`
- Create: `tests/nodes/transform.spec.ts`
- Modify: `src/domain/node-types.ts` (add `TransformConfig`, extend union)
- Modify: `src/main.ts` (add `import '@/nodes/transform';`)
- Modify: `src/nodes/port-types.ts` (Transform is `value` in / `result` out)

The Transform node has one config field `mode` plus mode-specific extras. We store the union shape in a single `TransformConfig`; the runtime branches on `mode`. Five modes:
- `json-parse` — `JSON.parse(input)` → object/array/etc.
- `json-stringify` — `JSON.stringify(input, null, 2)` → string
- `json-path` — read `node.config.path` (e.g. `"messages[-1].content"`) from input → unknown
- `regex-extract` — match `node.config.pattern` against string input, return `match[node.config.group ?? 0]` or null
- `template` — `renderTemplate(node.config.template, { value: input })` → string

- [ ] **Step 1: Add the type**

Modify `src/domain/node-types.ts`. Add:

```ts
export interface TransformConfig {
  mode: 'json-parse' | 'json-stringify' | 'json-path' | 'regex-extract' | 'template';
  /** json-path: dot-and-bracket path expression. Example: 'a.b[0].c' or 'messages[-1].content'. */
  path?: string;
  /** regex-extract: source pattern; flags applied automatically (g not used — single match). */
  pattern?: string;
  /** regex-extract: which capture group to return. 0 = whole match. */
  group?: number;
  /** template: a string with {{value}} placeholders rendered with the input value. */
  template?: string;
}
```

And add it to the `NodeConfig` union near `ToolRunnerConfig`:

```ts
export type NodeConfig =
  | InputConfig
  | OutputConfig
  | LLMCallConfig
  | ToolConfig
  | ToolGroupConfig
  | ToolRunnerConfig
  | TransformConfig
  | LoopControllerConfig
  | AgentConfig
  | Record<string, unknown>;
```

- [ ] **Step 2: Write failing tests**

Create `tests/nodes/transform.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { transformNode } from '@/nodes/transform';
import type { Node } from '@/domain/graph';

function makeNode(config: Record<string, unknown>): Node {
  return { id: 't', type: 'transform', position: { x: 0, y: 0 }, config };
}

const ctx = () => ({ signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '' });

describe('transformNode', () => {
  it('json-parse: parses a JSON string into an object', async () => {
    const out = await transformNode.run(makeNode({ mode: 'json-parse' }), { value: '{"a":1}' }, ctx());
    expect(out.result).toEqual({ a: 1 });
  });

  it('json-parse: throws a clear error on invalid JSON', async () => {
    await expect(
      transformNode.run(makeNode({ mode: 'json-parse' }), { value: 'not json' }, ctx())
    ).rejects.toThrow(/JSON/);
  });

  it('json-stringify: serializes an object to a 2-space indented string', async () => {
    const out = await transformNode.run(makeNode({ mode: 'json-stringify' }), { value: { a: 1 } }, ctx());
    expect(out.result).toBe('{\n  "a": 1\n}');
  });

  it('json-path: reads a deep field by dot-path', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'json-path', path: 'a.b.c' }),
      { value: { a: { b: { c: 'found' } } } },
      ctx(),
    );
    expect(out.result).toBe('found');
  });

  it('json-path: indexes into arrays with [n] (and supports -1 for last)', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'json-path', path: 'msgs[-1].content' }),
      { value: { msgs: [{ content: 'first' }, { content: 'last' }] } },
      ctx(),
    );
    expect(out.result).toBe('last');
  });

  it('json-path: returns undefined for a missing path', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'json-path', path: 'a.missing' }),
      { value: { a: {} } },
      ctx(),
    );
    expect(out.result).toBeUndefined();
  });

  it('regex-extract: returns the whole match when group is omitted', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: '\\d+' }),
      { value: 'order #42 placed' },
      ctx(),
    );
    expect(out.result).toBe('42');
  });

  it('regex-extract: returns the requested capture group', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: 'order #(\\d+)', group: 1 }),
      { value: 'order #42 placed' },
      ctx(),
    );
    expect(out.result).toBe('42');
  });

  it('regex-extract: returns null when there is no match', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'regex-extract', pattern: '\\d+' }),
      { value: 'no digits' },
      ctx(),
    );
    expect(out.result).toBeNull();
  });

  it('template: renders {{value}} with the input', async () => {
    const out = await transformNode.run(
      makeNode({ mode: 'template', template: 'Hello {{value}}!' }),
      { value: 'world' },
      ctx(),
    );
    expect(out.result).toBe('Hello world!');
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm run test:run -- tests/nodes/transform.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/nodes/transform.ts`:

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { TransformConfig } from '@/domain/node-types';
import { renderTemplate } from './_internals/template-vars';

const PATH_SEGMENT = /([^.[\]]+)|\[(-?\d+)\]/g;

function readJsonPath(value: unknown, path: string): unknown {
  if (!path) return value;
  let cursor: unknown = value;
  PATH_SEGMENT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_SEGMENT.exec(path)) !== null) {
    if (cursor === null || cursor === undefined) return undefined;
    if (m[1] !== undefined) {
      // object key
      cursor = (cursor as Record<string, unknown>)[m[1]];
    } else {
      // array index (m[2])
      const idx = parseInt(m[2], 10);
      if (!Array.isArray(cursor)) return undefined;
      const arr = cursor as unknown[];
      const real = idx < 0 ? arr.length + idx : idx;
      cursor = arr[real];
    }
  }
  return cursor;
}

export const transformNode: NodeDefinition = {
  type: 'transform',
  inputPorts: ['value'],
  outputPorts: ['result'],
  async run(node, inputs) {
    const cfg = node.config as TransformConfig;
    const value = inputs.value;

    switch (cfg.mode) {
      case 'json-parse': {
        if (typeof value !== 'string') {
          throw new Error('Transform json-parse: input is not a string');
        }
        try { return { result: JSON.parse(value) }; }
        catch (e) { throw new Error(`Transform json-parse: invalid JSON — ${(e as Error).message}`); }
      }
      case 'json-stringify': {
        return { result: JSON.stringify(value, null, 2) };
      }
      case 'json-path': {
        const path = cfg.path ?? '';
        return { result: readJsonPath(value, path) };
      }
      case 'regex-extract': {
        if (typeof value !== 'string') {
          throw new Error('Transform regex-extract: input is not a string');
        }
        if (!cfg.pattern) throw new Error('Transform regex-extract: no pattern configured');
        const re = new RegExp(cfg.pattern);
        const match = value.match(re);
        if (!match) return { result: null };
        const group = cfg.group ?? 0;
        return { result: match[group] ?? null };
      }
      case 'template': {
        const tpl = cfg.template ?? '';
        return { result: renderTemplate(tpl, { value }) };
      }
      default: {
        throw new Error(`Transform: unknown mode "${(cfg as { mode: string }).mode}"`);
      }
    }
  },
};

registerNodeDefinition(transformNode);
```

- [ ] **Step 5: Register in main**

Modify `src/main.ts`. Add alongside the other node imports (alphabetical position; insert after `'@/nodes/tool-runner';`):

```ts
import '@/nodes/transform';
```

- [ ] **Step 6: Add port types**

Modify `src/nodes/port-types.ts`. In `getSourcePortType`, add a case for `transform`:

```ts
    case 'transform':
      if (handleId === 'result') return 'json';
      return null;
```

In `getTargetPortType`, add:

```ts
    case 'transform':
      if (handleId === 'value') return 'json';
      return null;
```

(Both directions are `json` — Transform takes anything in, can produce anything out. The symmetric universal-json rule from Plan 3 makes wires permissive.)

- [ ] **Step 7: Run typecheck + full suite**

Run: `npm run typecheck && npm run test:run`
Expected: PASS, 80 tests (70 prior + 10 new).

- [ ] **Step 8: Commit**

```bash
git add src/nodes/transform.ts tests/nodes/transform.spec.ts \
  src/domain/node-types.ts src/nodes/port-types.ts src/main.ts
git commit -m "feat(node): transform node with json-parse/stringify/path/regex/template modes"
```

---

## Task 3: Transform node — UI

**Files:**
- Create: `src/components/nodes/TransformNode.vue`
- Create: `src/components/inspectors/TransformInspector.vue`
- Modify: `src/components/Canvas.vue` (`nodeTypes`)
- Modify: `src/components/AddNodeMenu.vue` (option + default config)
- Modify: `src/components/Inspector.vue` (router branch)

- [ ] **Step 1: Create the card**

Create `src/components/nodes/TransformNode.vue`:

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';
import type { TransformConfig } from '@/domain/node-types';

const props = defineProps<{ id: string; data: { config: TransformConfig } }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});
function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div
    class="node-shell group w-[220px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#4ad7e2] flex-shrink-0" title="transform" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Transform</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ data.config.mode }}</div>
      </div>
      <button
        type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>
    <div class="relative h-6 rounded-b-md flex items-center justify-between px-3 text-[11px]">
      <span class="text-text-dim font-mono text-[10px]">value</span>
      <Handle id="value" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
      <span class="text-text-dim font-mono text-[10px]">result</span>
      <Handle id="result" type="source" :position="Position.Right" :style="{ background: colorForType('json') }" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create the inspector**

Create `src/components/inspectors/TransformInspector.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { TransformConfig } from '@/domain/node-types';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as TransformConfig | null);

function update<K extends keyof TransformConfig>(key: K, value: TransformConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Mode
      <select
        :value="cfg.mode"
        @change="(e) => update('mode', (e.target as HTMLSelectElement).value as TransformConfig['mode'])"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
      >
        <option value="json-parse">json-parse</option>
        <option value="json-stringify">json-stringify</option>
        <option value="json-path">json-path</option>
        <option value="regex-extract">regex-extract</option>
        <option value="template">template</option>
      </select>
    </label>

    <label v-if="cfg.mode === 'json-path'" class="flex flex-col gap-1 text-xs opacity-85">
      Path
      <input
        :value="cfg.path ?? ''"
        @input="(e) => update('path', (e.target as HTMLInputElement).value)"
        placeholder="e.g. messages[-1].content"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-mono"
      >
      <div class="text-[11px] opacity-60">Dot-separated keys; <code class="font-mono">[n]</code> for arrays; negative indexes count from the end.</div>
    </label>

    <template v-if="cfg.mode === 'regex-extract'">
      <label class="flex flex-col gap-1 text-xs opacity-85">
        Pattern
        <input
          :value="cfg.pattern ?? ''"
          @input="(e) => update('pattern', (e.target as HTMLInputElement).value)"
          placeholder="e.g. order #(\\d+)"
          class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-mono"
        >
      </label>
      <label class="flex flex-col gap-1 text-xs opacity-85">
        Group
        <input
          type="number" min="0"
          :value="cfg.group ?? 0"
          @input="(e) => update('group', parseInt((e.target as HTMLInputElement).value, 10) || 0)"
          class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
        >
        <div class="text-[11px] opacity-60">0 = the whole match. 1+ = capture groups.</div>
      </label>
    </template>

    <label v-if="cfg.mode === 'template'" class="flex flex-col gap-1 text-xs opacity-85">
      Template
      <textarea
        :value="cfg.template ?? ''"
        @input="(e) => update('template', (e.target as HTMLTextAreaElement).value)"
        rows="4"
        placeholder="Hello {{value}}!"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-mono resize-y"
      ></textarea>
      <div class="text-[11px] opacity-60">Use <code class="font-mono">{{ '{{' }}value{{ '}}' }}</code> to refer to the input.</div>
    </label>

    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[{ id: 'value', type: 'json', description: 'Input value (any shape).' }]"
      :outputs="[{ id: 'result', type: 'json', description: 'Transformed output (mode-dependent).' }]"
    />
  </div>
</template>
```

- [ ] **Step 3: Register in Canvas / AddNodeMenu / Inspector**

`src/components/Canvas.vue` — import and add to `nodeTypes`:

```ts
import TransformNode from './nodes/TransformNode.vue';
// in nodeTypes:
'transform': markRaw(TransformNode),
```

`src/components/AddNodeMenu.vue` — append to `ALL_OPTIONS` (insert after `tool-runner`):

```ts
{ type: 'transform', label: 'Transform', description: 'Parse / extract / reformat data between nodes' },
```

And in `defaultConfig`:

```ts
case 'transform': return { mode: 'json-parse' };
```

`src/components/Inspector.vue` — import and add `v-else-if` branch (insert before the catch-all):

```ts
import TransformInspector from './inspectors/TransformInspector.vue';
```
```vue
<div v-else-if="selectedNode.type === 'transform'">
  <TransformInspector :nodeId="selectedNode.id" />
</div>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run test:run`
Expected: typecheck clean, 80 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/nodes/TransformNode.vue \
  src/components/inspectors/TransformInspector.vue \
  src/components/Canvas.vue src/components/AddNodeMenu.vue src/components/Inspector.vue
git commit -m "feat(ui): Transform node card + inspector"
```

---

## Task 4: Prompt Template node — engine + tests

**Files:**
- Create: `src/nodes/prompt-template.ts`
- Create: `tests/nodes/prompt-template.spec.ts`
- Modify: `src/domain/node-types.ts` (add `PromptTemplateConfig`, extend union)
- Modify: `src/main.ts`
- Modify: `src/nodes/port-types.ts` (dynamic input ports per `{{var}}`)

- [ ] **Step 1: Add the type**

Modify `src/domain/node-types.ts`. Add:

```ts
export interface PromptTemplateConfig {
  template: string;  // contains {{var}} placeholders
}
```

And add to the `NodeConfig` union:

```ts
  | TransformConfig
  | PromptTemplateConfig
  | LoopControllerConfig
```

- [ ] **Step 2: Write failing tests**

Create `tests/nodes/prompt-template.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { promptTemplateNode } from '@/nodes/prompt-template';
import type { Node } from '@/domain/graph';

function makeNode(template: string): Node {
  return { id: 'pt', type: 'prompt-template', position: { x: 0, y: 0 }, config: { template } };
}
const ctx = () => ({ signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: '' });

describe('promptTemplateNode', () => {
  it('renders a template with no placeholders verbatim', async () => {
    const out = await promptTemplateNode.run(makeNode('plain'), {}, ctx());
    expect(out.rendered).toBe('plain');
  });

  it('substitutes a single placeholder from inputs', async () => {
    const out = await promptTemplateNode.run(makeNode('Hi {{name}}'), { name: 'Ada' }, ctx());
    expect(out.rendered).toBe('Hi Ada');
  });

  it('substitutes multiple placeholders from inputs', async () => {
    const out = await promptTemplateNode.run(
      makeNode('{{greeting}}, {{name}}'),
      { greeting: 'Hello', name: 'Ada' },
      ctx(),
    );
    expect(out.rendered).toBe('Hello, Ada');
  });

  it('coerces non-string inputs to JSON', async () => {
    const out = await promptTemplateNode.run(
      makeNode('count={{n}} list={{xs}}'),
      { n: 3, xs: [1, 2, 3] },
      ctx(),
    );
    expect(out.rendered).toBe('count=3 list=[1,2,3]');
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm run test:run -- tests/nodes/prompt-template.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/nodes/prompt-template.ts`:

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { PromptTemplateConfig } from '@/domain/node-types';
import { renderTemplate } from './_internals/template-vars';

export const promptTemplateNode: NodeDefinition = {
  type: 'prompt-template',
  // The static port lists describe the OUTPUT only; dynamic inputs are resolved
  // by port-types.ts at connection time using the live template config.
  inputPorts: [],
  outputPorts: ['rendered'],
  async run(node, inputs) {
    const cfg = node.config as PromptTemplateConfig;
    return { rendered: renderTemplate(cfg.template ?? '', inputs) };
  },
};

registerNodeDefinition(promptTemplateNode);
```

- [ ] **Step 5: Register in main**

Add to `src/main.ts` (alphabetical, after `'@/nodes/output';`):

```ts
import '@/nodes/prompt-template';
```

- [ ] **Step 6: Add port types — dynamic on the input side**

Modify `src/nodes/port-types.ts`. In `getSourcePortType`, add:

```ts
    case 'prompt-template':
      if (handleId === 'rendered') return 'string';
      return null;
```

In `getTargetPortType`, add:

```ts
    case 'prompt-template': {
      const cfg = node.config as { template?: string };
      // Dynamic: any handle that matches a {{var}} placeholder in the template.
      // Keep this fast — re-import is cheap, no need to cache.
      const tpl = cfg.template ?? '';
      const re = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(tpl)) !== null) {
        if (m[1] === handleId) return 'json';
      }
      return null;
    }
```

(`json` because placeholders accept any input; `renderTemplate` coerces.)

- [ ] **Step 7: Run typecheck + full suite**

Run: `npm run typecheck && npm run test:run`
Expected: PASS, 84 tests (80 prior + 4 new).

- [ ] **Step 8: Commit**

```bash
git add src/nodes/prompt-template.ts tests/nodes/prompt-template.spec.ts \
  src/domain/node-types.ts src/nodes/port-types.ts src/main.ts
git commit -m "feat(node): prompt-template with dynamic {{var}} input ports"
```

---

## Task 5: Prompt Template node — UI

**Files:**
- Create: `src/components/nodes/PromptTemplateNode.vue`
- Create: `src/components/inspectors/PromptTemplateInspector.vue`
- Modify: `src/components/Canvas.vue`
- Modify: `src/components/AddNodeMenu.vue`
- Modify: `src/components/Inspector.vue`

- [ ] **Step 1: Card**

Create `src/components/nodes/PromptTemplateNode.vue`:

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';
import type { PromptTemplateConfig } from '@/domain/node-types';
import { extractPlaceholders } from '@/nodes/_internals/template-vars';

const props = defineProps<{ id: string; data: { config: PromptTemplateConfig } }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running': case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});
const placeholders = computed(() => extractPlaceholders(props.data.config.template ?? ''));
function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div
    class="node-shell group w-[240px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#ffaa55] flex-shrink-0" title="prompt template" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Prompt Template</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ placeholders.length }} {{ placeholders.length === 1 ? 'var' : 'vars' }}</div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>

    <!-- Dynamic input rows, one per placeholder -->
    <div v-if="placeholders.length === 0" class="px-3 py-2 text-[11px] text-text-dim italic opacity-60">
      No {{ '{{vars}}' }} in template — output is the template literal.
    </div>
    <div
      v-for="name in placeholders"
      :key="name"
      class="relative h-6 flex items-center px-3 text-[11px]"
    >
      <Handle :id="name" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
      <span class="text-text-dim font-mono text-[10px]">{{ name }}</span>
    </div>

    <div class="relative h-6 rounded-b-md flex items-center justify-end pr-3 text-[11px] border-t border-[#16181c] bg-[#16181c]">
      <span class="text-text-dim font-mono text-[10px]">rendered</span>
      <Handle id="rendered" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Inspector**

Create `src/components/inspectors/PromptTemplateInspector.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { PromptTemplateConfig } from '@/domain/node-types';
import { extractPlaceholders } from '@/nodes/_internals/template-vars';
import MonacoEditor from '@/components/MonacoEditor.vue';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as PromptTemplateConfig | null);
const placeholders = computed(() => extractPlaceholders(cfg.value?.template ?? ''));

function update(key: keyof PromptTemplateConfig, value: string) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Template
      <div class="rounded border border-border-base overflow-hidden">
        <MonacoEditor
          :model-value="cfg.template ?? ''"
          @update:model-value="(v: string) => update('template', v)"
          language="markdown"
          height="200px"
        />
      </div>
      <div class="text-[11px] opacity-60">
        Use <code class="font-mono">{{ '{{name}}' }}</code> to declare an input port. Each unique
        placeholder becomes a target handle on the card.
      </div>
    </label>

    <section v-if="placeholders.length">
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1.5">Detected ({{ placeholders.length }})</div>
      <ul class="flex flex-col gap-1 text-[11px] font-mono">
        <li v-for="name in placeholders" :key="name" class="opacity-80">{{ name }}</li>
      </ul>
    </section>

    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[{ id: '<varname>', type: 'json', description: 'One target per {{varname}} in the template.' }]"
      :outputs="[{ id: 'rendered', type: 'string', description: 'The template with all placeholders substituted.' }]"
    />
  </div>
</template>
```

- [ ] **Step 3: Register in Canvas / AddNodeMenu / Inspector**

`Canvas.vue`: `import PromptTemplateNode from './nodes/PromptTemplateNode.vue';` and `'prompt-template': markRaw(PromptTemplateNode),` in `nodeTypes`.

`AddNodeMenu.vue` — append:

```ts
{ type: 'prompt-template', label: 'Prompt Template', description: 'String template with {{var}} placeholders' },
```
And:

```ts
case 'prompt-template': return { template: 'Hello {{name}}!' };
```

`Inspector.vue` — import and branch:

```ts
import PromptTemplateInspector from './inspectors/PromptTemplateInspector.vue';
```
```vue
<div v-else-if="selectedNode.type === 'prompt-template'">
  <PromptTemplateInspector :nodeId="selectedNode.id" />
</div>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run test:run`
Expected: clean + 84 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/nodes/PromptTemplateNode.vue \
  src/components/inspectors/PromptTemplateInspector.vue \
  src/components/Canvas.vue src/components/AddNodeMenu.vue src/components/Inspector.vue
git commit -m "feat(ui): Prompt Template card + Monaco-backed inspector"
```

---

## Task 6: Chat Input + Chat Output — engine + ctx wiring

**Files:**
- Create: `src/nodes/chat-input.ts`
- Create: `src/nodes/chat-output.ts`
- Create: `tests/nodes/chat-nodes.spec.ts`
- Modify: `src/nodes/registry.ts` (add `chatSession?` to `NodeRunContext`)
- Modify: `src/engine/runner.ts` (accept `chatSession?` in `RunGraphArgs`, pass through to ctx)
- Modify: `src/domain/node-types.ts` (`ChatInputConfig`, `ChatOutputConfig`, extend union)
- Modify: `src/nodes/port-types.ts` (Chat Input / Output port resolvers)
- Modify: `src/main.ts`

- [ ] **Step 1: Add types**

Modify `src/domain/node-types.ts`:

```ts
export interface ChatInputConfig {
  // intentionally empty — the chat sidebar provides the runtime session
}

export interface ChatOutputConfig {
  format: 'text' | 'markdown';
}
```

Add to the `NodeConfig` union:

```ts
  | PromptTemplateConfig
  | ChatInputConfig
  | ChatOutputConfig
  | LoopControllerConfig
```

- [ ] **Step 2: Extend runtime context**

Modify `src/nodes/registry.ts`. Above the existing `NodeRunContext` interface, add:

```ts
import type { ChatMessage } from '@/openrouter/types';

export interface ChatSession {
  /** The just-submitted user message text. */
  userMessage: string;
  /** Full chat history including the latest user message at the end. */
  history: ChatMessage[];
}
```

Then add `chatSession?: ChatSession` to `NodeRunContext`:

```ts
export interface NodeRunContext {
  signal: AbortSignal;
  details: Record<string, unknown>;
  onStreamUpdate?: (preview: string) => void;
  onIterationComplete?: (record: IterationRecord) => void;
  /** Set by the runner when the run was triggered by a chat-sidebar submission. */
  chatSession?: ChatSession;
  apiKey: string;
}
```

- [ ] **Step 3: Forward chatSession from the runner**

Modify `src/engine/runner.ts`. Extend `RunGraphArgs`:

```ts
export interface RunGraphArgs {
  graph: Graph;
  apiKey: string;
  chatSession?: import('@/nodes/registry').ChatSession;
}
```

In the per-node ctx construction (the inner block where `const ctx = { ... };` is built), add the field:

```ts
const ctx = {
  signal: controller.signal,
  details: result.details,
  onStreamUpdate: (preview: string) => runStore.setLivePreview(id, preview),
  onIterationComplete: (record: import('@/domain/run').IterationRecord) => {
    if (!result.iterations) result.iterations = [];
    result.iterations.push(record);
  },
  chatSession: args.chatSession,
  apiKey: args.apiKey,
};
```

Also forward `chatSession` to `driveLoop`:

In the loop-controller branch's `driveLoop({...})` call, add:

```ts
chatSession: args.chatSession,
```

Modify `src/engine/loop-driver.ts`. Add `chatSession?: ChatSession` to `LoopDriverArgs`:

```ts
import type { ChatSession } from '@/nodes/registry';

export interface LoopDriverArgs {
  // ...existing fields...
  chatSession?: ChatSession;
}
```

And pass it into both ctx constructions inside `driveLoop` (the controller's ctx and each body node's ctx). For each, add `chatSession: args.chatSession,`.

- [ ] **Step 4: Write failing tests**

Create `tests/nodes/chat-nodes.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { chatInputNode } from '@/nodes/chat-input';
import { chatOutputNode } from '@/nodes/chat-output';
import type { Node } from '@/domain/graph';

function makeNode(type: 'chat-input' | 'chat-output', config: Record<string, unknown> = {}): Node {
  return { id: 'n', type, position: { x: 0, y: 0 }, config };
}

const baseCtx = (chatSession?: { userMessage: string; history: { role: string; content: string }[] }) => ({
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
  chatSession: chatSession as never,
});

describe('chatInputNode', () => {
  it('emits userMessage and messages from ctx.chatSession', async () => {
    const session = {
      userMessage: 'hello',
      history: [
        { role: 'user' as const, content: 'previous' },
        { role: 'assistant' as const, content: 'reply' },
        { role: 'user' as const, content: 'hello' },
      ],
    };
    const out = await chatInputNode.run(makeNode('chat-input'), {}, baseCtx(session));
    expect(out.userMessage).toBe('hello');
    expect(out.messages).toEqual(session.history);
  });

  it('throws when invoked without a chatSession (graph run from canvas, not chat)', async () => {
    await expect(
      chatInputNode.run(makeNode('chat-input'), {}, baseCtx())
    ).rejects.toThrow(/chat session/i);
  });
});

describe('chatOutputNode', () => {
  it('records the input text on details.value', async () => {
    const ctx = baseCtx();
    await chatOutputNode.run(makeNode('chat-output', { format: 'markdown' }), { text: 'hi there' }, ctx);
    expect(ctx.details.value).toBe('hi there');
  });

  it('coerces non-string input via String()', async () => {
    const ctx = baseCtx();
    await chatOutputNode.run(makeNode('chat-output', { format: 'text' }), { text: 42 as unknown as string }, ctx);
    expect(ctx.details.value).toBe('42');
  });
});
```

- [ ] **Step 5: Run tests, verify they fail**

Run: `npm run test:run -- tests/nodes/chat-nodes.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement Chat Input**

Create `src/nodes/chat-input.ts`:

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';

export const chatInputNode: NodeDefinition = {
  type: 'chat-input',
  inputPorts: [],
  outputPorts: ['userMessage', 'messages'],
  async run(_node, _inputs, ctx) {
    if (!ctx.chatSession) {
      throw new Error(
        'Chat Input has no chat session — run the graph from the chat sidebar, not the toolbar.',
      );
    }
    return {
      userMessage: ctx.chatSession.userMessage,
      messages: ctx.chatSession.history,
    };
  },
};

registerNodeDefinition(chatInputNode);
```

- [ ] **Step 7: Implement Chat Output**

Create `src/nodes/chat-output.ts`:

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';

export const chatOutputNode: NodeDefinition = {
  type: 'chat-output',
  inputPorts: ['text'],
  outputPorts: [],
  async run(_node, inputs, ctx) {
    const text = typeof inputs.text === 'string' ? inputs.text : String(inputs.text ?? '');
    ctx.details.value = text;
    return {};
  },
};

registerNodeDefinition(chatOutputNode);
```

- [ ] **Step 8: Register in main**

Modify `src/main.ts`:

```ts
import '@/nodes/chat-input';
import '@/nodes/chat-output';
```

(Insert alphabetically — both come before `'@/nodes/input'`.)

- [ ] **Step 9: Add port types**

Modify `src/nodes/port-types.ts`. In `getSourcePortType`:

```ts
    case 'chat-input':
      if (handleId === 'userMessage') return 'string';
      if (handleId === 'messages') return 'messages';
      return null;
```

In `getTargetPortType`:

```ts
    case 'chat-output':
      if (handleId === 'text') return 'string';
      return null;
```

- [ ] **Step 10: Run typecheck + full suite**

Run: `npm run typecheck && npm run test:run`
Expected: PASS, 88 tests (84 prior + 4 new).

- [ ] **Step 11: Commit**

```bash
git add src/nodes/chat-input.ts src/nodes/chat-output.ts \
  tests/nodes/chat-nodes.spec.ts \
  src/domain/node-types.ts src/nodes/registry.ts src/engine/runner.ts \
  src/engine/loop-driver.ts src/nodes/port-types.ts src/main.ts
git commit -m "feat(node): chat-input + chat-output with chatSession in runner ctx"
```

---

## Task 7: Chat Input + Chat Output — UI

**Files:**
- Create: `src/components/nodes/ChatInputNode.vue`
- Create: `src/components/inspectors/ChatInputInspector.vue`
- Create: `src/components/nodes/ChatOutputNode.vue`
- Create: `src/components/inspectors/ChatOutputInspector.vue`
- Modify: `src/components/Canvas.vue`, `src/components/AddNodeMenu.vue`, `src/components/Inspector.vue`

- [ ] **Step 1: Chat Input card**

Create `src/components/nodes/ChatInputNode.vue`:

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';

const props = defineProps<{ id: string }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running': case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});
function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div
    class="node-shell group w-[220px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#b388ff] flex-shrink-0" title="chat input" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Chat Input</div>
        <div class="text-text-dim text-[10px] font-mono truncate">from sidebar</div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>
    <div class="py-1">
      <div class="relative h-6 flex items-center justify-end pr-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">userMessage</span>
        <Handle id="userMessage" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
      </div>
      <div class="relative h-6 flex items-center justify-end pr-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="source" :position="Position.Right" :style="{ background: colorForType('messages') }" />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Chat Output card**

Create `src/components/nodes/ChatOutputNode.vue`:

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';

const props = defineProps<{ id: string }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running': case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});
function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div
    class="node-shell group w-[220px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#b388ff] flex-shrink-0" title="chat output" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Chat Output</div>
        <div class="text-text-dim text-[10px] font-mono truncate">to sidebar</div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>
    <div class="relative h-6 rounded-b-md flex items-center px-3 text-[11px]">
      <Handle id="text" type="target" :position="Position.Left" :style="{ background: colorForType('string') }" />
      <span class="text-text-dim font-mono text-[10px]">text</span>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Chat Input inspector (with multi-turn warning)**

Create `src/components/inspectors/ChatInputInspector.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

// Spec §6.12 UX warning: if userMessage has outgoing edges but messages doesn't,
// AND the graph has an LLM Call or Agent, warn that chat will feel amnesiac.
const warning = computed(() => {
  const userMsgEdges = graph.edges.filter((e) => e.source === props.nodeId && e.sourceHandle === 'userMessage');
  const messagesEdges = graph.edges.filter((e) => e.source === props.nodeId && e.sourceHandle === 'messages');
  if (userMsgEdges.length === 0 || messagesEdges.length > 0) return null;
  const hasLLM = graph.nodes.some((n) => n.type === 'llm-call' || n.type === 'agent');
  if (!hasLLM) return null;
  return 'Connect `messages` for multi-turn context — otherwise the LLM only sees the latest user message and the chat will feel amnesiac across turns.';
});
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="text-xs opacity-60">
      Receives the user's submission from the chat sidebar at run time. Wire <code class="font-mono">messages</code> into your LLM Call's <code class="font-mono">messages</code> input for multi-turn chat.
    </div>
    <div v-if="warning" class="bg-yellow-500/15 border border-yellow-500/40 rounded px-2 py-1.5 text-[11px] text-yellow-200">
      ⚠ {{ warning }}
    </div>
    <IOValues :node-id="nodeId" />
    <PortLegend
      :outputs="[
        { id: 'userMessage', type: 'string', description: 'The latest user message (single turn).' },
        { id: 'messages', type: 'messages', description: 'Full chat history including the latest user message.' },
      ]"
    />
  </div>
</template>
```

- [ ] **Step 4: Chat Output inspector**

Create `src/components/inspectors/ChatOutputInspector.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { ChatOutputConfig } from '@/domain/node-types';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ChatOutputConfig | null);

function update(key: keyof ChatOutputConfig, value: ChatOutputConfig[keyof ChatOutputConfig]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Format
      <select
        :value="cfg.format"
        @change="(e) => update('format', (e.target as HTMLSelectElement).value as ChatOutputConfig['format'])"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
      >
        <option value="markdown">markdown</option>
        <option value="text">text</option>
      </select>
    </label>
    <div class="text-xs opacity-60">
      Renders the assistant turn in the chat sidebar. <code class="font-mono">markdown</code> applies basic
      formatting; <code class="font-mono">text</code> renders verbatim.
    </div>
    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[{ id: 'text', type: 'string', description: 'The assistant reply to display.' }]"
    />
  </div>
</template>
```

- [ ] **Step 5: Register in Canvas / AddNodeMenu / Inspector**

`Canvas.vue`:

```ts
import ChatInputNode from './nodes/ChatInputNode.vue';
import ChatOutputNode from './nodes/ChatOutputNode.vue';
// in nodeTypes:
'chat-input': markRaw(ChatInputNode),
'chat-output': markRaw(ChatOutputNode),
```

`AddNodeMenu.vue` — append:

```ts
{ type: 'chat-input', label: 'Chat Input', description: 'Source from the chat sidebar' },
{ type: 'chat-output', label: 'Chat Output', description: 'Sink to the chat sidebar' },
```

In `defaultConfig`:

```ts
case 'chat-input': return {};
case 'chat-output': return { format: 'markdown' };
```

`Inspector.vue` — imports + branches:

```ts
import ChatInputInspector from './inspectors/ChatInputInspector.vue';
import ChatOutputInspector from './inspectors/ChatOutputInspector.vue';
```
```vue
<div v-else-if="selectedNode.type === 'chat-input'">
  <ChatInputInspector :nodeId="selectedNode.id" />
</div>
<div v-else-if="selectedNode.type === 'chat-output'">
  <ChatOutputInspector :nodeId="selectedNode.id" />
</div>
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run test:run`
Expected: typecheck clean, 88 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/nodes/ChatInputNode.vue src/components/nodes/ChatOutputNode.vue \
  src/components/inspectors/ChatInputInspector.vue src/components/inspectors/ChatOutputInspector.vue \
  src/components/Canvas.vue src/components/AddNodeMenu.vue src/components/Inspector.vue
git commit -m "feat(ui): Chat Input + Chat Output cards & inspectors"
```

---

## Task 8: Chat sidebar — store, panel, integration

**Files:**
- Create: `src/stores/chat.ts`
- Create: `src/components/chat/ChatPanel.vue`
- Create: `src/components/chat/ChatBubble.vue`
- Create: `tests/stores/chat.spec.ts`
- Modify: `src/components/LeftTabs.vue` (swap placeholder for `<ChatPanel />` when chat-active)

- [ ] **Step 1: Add Markdown rendering dep**

Run from the project root:

```bash
npm install marked
```

Expected: `marked` added to `package.json` dependencies. (Used only in ChatBubble for markdown rendering.)

- [ ] **Step 2: Chat store with TDD**

Create `tests/stores/chat.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChatStore } from '@/stores/chat';

// Stub the runner module — we test the store's submit flow, not the engine.
vi.mock('@/engine/runner', () => ({
  runGraph: vi.fn(async () => ({
    schemaVersion: 1, id: 'r', graphId: 'g', graphSnapshot: {} as never,
    startedAt: '', endedAt: null, status: 'completed' as const,
    inputs: {}, errors: [],
    nodeResults: {
      out: { nodeId: 'out', status: 'done', details: { value: 'mocked reply' } } as never,
    },
  })),
}));

describe('useChatStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('starts with an empty thread and idle status', () => {
    const chat = useChatStore();
    expect(chat.thread).toEqual([]);
    expect(chat.status).toBe('idle');
  });

  it('clear() empties the thread', () => {
    const chat = useChatStore();
    chat.thread.push({ role: 'user', content: 'hi' });
    chat.clear();
    expect(chat.thread).toEqual([]);
  });

  it('submit() appends user, runs graph, appends assistant from chat-output details.value', async () => {
    const chat = useChatStore();
    const graph = {
      schemaVersion: 1 as const, id: 'g', name: 'g', createdAt: '', updatedAt: '',
      nodes: [
        { id: 'in', type: 'chat-input' as const, position: { x: 0, y: 0 }, config: {} },
        { id: 'out', type: 'chat-output' as const, position: { x: 0, y: 0 }, config: { format: 'markdown' as const } },
      ],
      edges: [],
      containsCustomCode: false,
    };
    await chat.submit({ graph, apiKey: 'k', userMessage: 'hello' });
    expect(chat.thread).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'mocked reply' },
    ]);
    expect(chat.status).toBe('idle');
  });

  it('submit() leaves thread with user-only message on runner error and surfaces error', async () => {
    const { runGraph } = await import('@/engine/runner');
    (runGraph as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(new Error('boom'));
    const chat = useChatStore();
    const graph = {
      schemaVersion: 1 as const, id: 'g', name: 'g', createdAt: '', updatedAt: '',
      nodes: [
        { id: 'in', type: 'chat-input' as const, position: { x: 0, y: 0 }, config: {} },
        { id: 'out', type: 'chat-output' as const, position: { x: 0, y: 0 }, config: { format: 'markdown' as const } },
      ],
      edges: [],
      containsCustomCode: false,
    };
    await chat.submit({ graph, apiKey: 'k', userMessage: 'hi' });
    expect(chat.thread).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Error: boom' },
    ]);
    expect(chat.status).toBe('idle');
  });
});
```

Run: `npm run test:run -- tests/stores/chat.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

Create `src/stores/chat.ts`:

```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Graph } from '@/domain/graph';
import type { ChatMessage } from '@/openrouter/types';
import { runGraph } from '@/engine/runner';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const useChatStore = defineStore('chat', () => {
  const thread = ref<ChatTurn[]>([]);
  const status = ref<'idle' | 'running'>('idle');

  function clear() {
    thread.value = [];
  }

  /**
   * Returns true if `graph` is a chat-active graph: has exactly one chat-input
   * AND exactly one chat-output node.
   */
  function isChatActive(graph: Graph | null): boolean {
    if (!graph) return false;
    const ins = graph.nodes.filter((n) => n.type === 'chat-input').length;
    const outs = graph.nodes.filter((n) => n.type === 'chat-output').length;
    return ins === 1 && outs === 1;
  }

  /**
   * Append the user message, run the graph, append the assistant reply (or error).
   */
  async function submit(args: { graph: Graph; apiKey: string; userMessage: string }) {
    const text = args.userMessage.trim();
    if (!text || status.value === 'running') return;

    thread.value.push({ role: 'user', content: text });
    status.value = 'running';

    // Build the ChatMessage[] history (sidebar uses {role, content}; LLMs need ChatMessage).
    const history: ChatMessage[] = thread.value.map((t) => ({ role: t.role, content: t.content }));

    try {
      const run = await runGraph({
        graph: args.graph,
        apiKey: args.apiKey,
        chatSession: { userMessage: text, history },
      });
      // Find the chat-output node and read its recorded value.
      const outId = args.graph.nodes.find((n) => n.type === 'chat-output')?.id;
      const reply =
        outId && run.nodeResults[outId]
          ? String(run.nodeResults[outId].details.value ?? '')
          : '';
      thread.value.push({ role: 'assistant', content: reply || '(no reply)' });
    } catch (e) {
      thread.value.push({ role: 'assistant', content: `Error: ${(e as Error).message}` });
    } finally {
      status.value = 'idle';
    }
  }

  return { thread, status, clear, isChatActive, submit };
});
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test:run -- tests/stores/chat.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Chat bubble component**

Create `src/components/chat/ChatBubble.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{ role: 'user' | 'assistant'; content: string; format?: 'text' | 'markdown' }>();

const html = computed(() => {
  if (props.format === 'text' || props.role === 'user') {
    // Escape HTML for safety; preserve line breaks.
    const escaped = props.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return escaped;
  }
  return marked.parse(props.content) as string;
});
</script>

<template>
  <div :class="['flex w-full mb-2', role === 'user' ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
        role === 'user'
          ? 'bg-accent/80 text-white'
          : 'bg-panel border border-border-base text-text-base'
      ]"
      v-html="html"
    />
  </div>
</template>
```

- [ ] **Step 6: Chat panel component**

Create `src/components/chat/ChatPanel.vue`:

```vue
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useChatStore } from '@/stores/chat';
import { useGraphStore } from '@/stores/graph';
import { useSettingsStore } from '@/stores/settings';
import ChatBubble from './ChatBubble.vue';

const chat = useChatStore();
const graph = useGraphStore();
const settings = useSettingsStore();

const input = ref('');
const scroller = ref<HTMLDivElement | null>(null);

async function onSubmit() {
  if (!input.value.trim() || chat.status === 'running') return;
  const text = input.value;
  input.value = '';
  await chat.submit({ graph: graph.exportGraph(), apiKey: settings.apiKey, userMessage: text });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSubmit();
  }
}

// Auto-scroll on new messages or running indicator.
watch(
  () => [chat.thread.length, chat.status],
  async () => {
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
);
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between px-3 py-2 border-b border-border-base">
      <strong class="text-xs uppercase tracking-wide opacity-70">Chat</strong>
      <button
        type="button"
        @click="chat.clear()"
        class="text-text-dim hover:text-text-base text-[11px]"
        :disabled="chat.status === 'running'"
      >Clear</button>
    </div>

    <div ref="scroller" class="flex-1 overflow-y-auto p-3">
      <div v-if="chat.thread.length === 0" class="text-center opacity-50 text-xs italic mt-8">
        No messages yet. Type below to start a turn.
      </div>
      <ChatBubble
        v-for="(t, i) in chat.thread"
        :key="i"
        :role="t.role"
        :content="t.content"
      />
      <div v-if="chat.status === 'running'" class="text-text-dim italic text-xs px-1 mb-2">
        running…
      </div>
    </div>

    <div class="border-t border-border-base p-2">
      <textarea
        v-model="input"
        @keydown="onKeydown"
        placeholder="Type a message — Enter to send, Shift+Enter for newline"
        rows="2"
        class="w-full bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui resize-none"
        :disabled="chat.status === 'running'"
      ></textarea>
    </div>
  </div>
</template>
```

- [ ] **Step 7: Wire into LeftTabs**

Modify `src/components/LeftTabs.vue`. Replace its current contents with:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGraphStore } from '@/stores/graph';
import { useChatStore } from '@/stores/chat';
import RunsList from './runs/RunsList.vue';
import ChatPanel from './chat/ChatPanel.vue';

const ui = useUiStore();
const graph = useGraphStore();
const chat = useChatStore();

const isChatActive = computed(() => chat.isChatActive(graph.exportGraph()));
</script>

<template>
  <div class="flex flex-col h-full text-sm">
    <div class="flex border-b border-border-base">
      <button
        type="button"
        @click="ui.leftActiveTab = 'chat'"
        :class="[
          'flex-1 py-2.5 cursor-pointer border-b-2',
          ui.leftActiveTab === 'chat'
            ? 'text-text-base bg-elev border-accent'
            : 'text-text-dim border-transparent',
        ]"
      >Chat</button>
      <button
        type="button"
        @click="ui.leftActiveTab = 'runs'"
        :class="[
          'flex-1 py-2.5 cursor-pointer border-b-2',
          ui.leftActiveTab === 'runs'
            ? 'text-text-base bg-elev border-accent'
            : 'text-text-dim border-transparent',
        ]"
      >Runs</button>
    </div>
    <div class="flex-1 overflow-hidden">
      <template v-if="ui.leftActiveTab === 'chat'">
        <ChatPanel v-if="isChatActive" />
        <div v-else class="flex items-center justify-center h-full opacity-50 p-3.5 text-center text-xs">
          This graph isn't a chat agent — add exactly one Chat Input + one Chat Output node to enable chat mode.
        </div>
      </template>
      <RunsList v-else />
    </div>
  </div>
</template>
```

(The existing template uses `<div class="flex-1 overflow-y-auto">` — we changed it to `overflow-hidden` to let `ChatPanel` manage its own scroll region. Verify with `grep -n "exportGraph" src/stores/graph.ts` that an `exportGraph()` method exists; if not, it's the same logic as the existing graph save — adapt by using `graph.nodes`, `graph.edges`, etc. directly in `isChatActive`.)

- [ ] **Step 8: If `exportGraph` doesn't exist, inline the chat-active check**

Run: `grep -n "exportGraph" src/stores/graph.ts`. If the result is empty, modify the `isChatActive` computed in `LeftTabs.vue` to read directly:

```ts
const isChatActive = computed(() => {
  const ins = graph.nodes.filter((n) => n.type === 'chat-input').length;
  const outs = graph.nodes.filter((n) => n.type === 'chat-output').length;
  return ins === 1 && outs === 1;
});
```

And in `ChatPanel.vue`, replace `graph.exportGraph()` with a `Graph` object built from the store's reactive fields:

```ts
async function onSubmit() {
  if (!input.value.trim() || chat.status === 'running') return;
  const text = input.value;
  input.value = '';
  // Build a plain Graph snapshot from store state for the runner.
  const snapshot: import('@/domain/graph').Graph = {
    schemaVersion: 1,
    id: graph.id ?? 'untitled',
    name: graph.name ?? 'Untitled',
    createdAt: graph.createdAt ?? '',
    updatedAt: graph.updatedAt ?? '',
    nodes: graph.nodes,
    edges: graph.edges,
    containsCustomCode: graph.containsCustomCode ?? false,
  };
  await chat.submit({ graph: snapshot, apiKey: settings.apiKey, userMessage: text });
}
```

(If `exportGraph()` does exist, skip this step entirely.)

- [ ] **Step 9: Verify + manual smoke**

Run: `npm run typecheck && npm run test:run`
Expected: typecheck clean, 92 tests (88 prior + 4 new).

Manual smoke (only if you have time):
1. `npm run dev`
2. New graph → add Chat Input + LLM Call + Chat Output → wire `chatInput.userMessage → llm.userMessage`, `llm.text → chatOutput.text` → save
3. Click the Chat tab in the left sidebar — chat panel should appear
4. Type "hello" → enter → see your message bubble, "running…" indicator, then assistant reply

- [ ] **Step 10: Commit**

```bash
git add src/stores/chat.ts \
  src/components/chat/ChatPanel.vue src/components/chat/ChatBubble.vue \
  src/components/LeftTabs.vue \
  tests/stores/chat.spec.ts \
  package.json package-lock.json
git commit -m "feat(chat): chat sidebar — store, panel, bubble, LeftTabs activation"
```

---

## Task 9: Bundled templates + "New from Template" toolbar action

**Files:**
- Create: `src/templates/data/01-hello-model.graph.json`
- Create: `src/templates/data/02-two-model-comparison.graph.json`
- Create: `src/templates/data/03-self-critique-fixed.graph.json`
- Create: `src/templates/data/04-rag-lite.graph.json`
- Create: `src/templates/data/05-raw-react-chat.graph.json`
- Create: `src/templates/data/06-encapsulated-agent-chat.graph.json`
- Create: `src/templates/index.ts`
- Create: `src/components/TemplatePickerModal.vue`
- Modify: `src/components/Toolbar.vue` (add the "Templates" button)

- [ ] **Step 1: Hello Model**

Create `src/templates/data/01-hello-model.graph.json`:

```json
{
  "schemaVersion": 1,
  "id": "tmpl-01-hello-model",
  "name": "Hello Model",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "updatedAt": "2026-05-02T00:00:00.000Z",
  "containsCustomCode": false,
  "nodes": [
    { "id": "in",  "type": "input",    "position": { "x": 60,  "y": 80 }, "config": { "name": "question", "defaultValue": "Tell me a fun fact about closures in JavaScript." } },
    { "id": "llm", "type": "llm-call", "position": { "x": 360, "y": 60 }, "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "", "temperature": 0.7, "maxTokens": null, "responseFormat": null } },
    { "id": "out", "type": "output",   "position": { "x": 720, "y": 80 }, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e1", "source": "in",  "sourceHandle": "value", "target": "llm", "targetHandle": "userMessage" },
    { "id": "e2", "source": "llm", "sourceHandle": "text",  "target": "out", "targetHandle": "value" }
  ]
}
```

- [ ] **Step 2: Two-Model Comparison**

Create `src/templates/data/02-two-model-comparison.graph.json`:

```json
{
  "schemaVersion": 1,
  "id": "tmpl-02-two-model-comparison",
  "name": "Two-Model Comparison",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "updatedAt": "2026-05-02T00:00:00.000Z",
  "containsCustomCode": false,
  "nodes": [
    { "id": "in",   "type": "input",    "position": { "x": 60,  "y": 200 }, "config": { "name": "question", "defaultValue": "Explain a closure in one sentence." } },
    { "id": "llm1", "type": "llm-call", "position": { "x": 360, "y": 80  }, "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "", "temperature": 0.5, "maxTokens": null, "responseFormat": null } },
    { "id": "llm2", "type": "llm-call", "position": { "x": 360, "y": 360 }, "config": { "model": "openai/gpt-oss-120b:free", "systemPrompt": "", "temperature": 0.5, "maxTokens": null, "responseFormat": null } },
    { "id": "out1", "type": "output",   "position": { "x": 720, "y": 80  }, "config": { "format": "auto" } },
    { "id": "out2", "type": "output",   "position": { "x": 720, "y": 360 }, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e1", "source": "in",   "sourceHandle": "value", "target": "llm1", "targetHandle": "userMessage" },
    { "id": "e2", "source": "in",   "sourceHandle": "value", "target": "llm2", "targetHandle": "userMessage" },
    { "id": "e3", "source": "llm1", "sourceHandle": "text",  "target": "out1", "targetHandle": "value" },
    { "id": "e4", "source": "llm2", "sourceHandle": "text",  "target": "out2", "targetHandle": "value" }
  ]
}
```

- [ ] **Step 3: Self-Critique (conditional halt with Transform)**

Create `src/templates/data/03-self-critique-fixed.graph.json`:

```json
{
  "schemaVersion": 1,
  "id": "tmpl-03-self-critique-fixed",
  "name": "Self-Critique Loop (with Transform)",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "updatedAt": "2026-05-02T00:00:00.000Z",
  "containsCustomCode": false,
  "nodes": [
    { "id": "in",     "type": "input",           "position": { "x": 40,  "y": 60  }, "config": { "name": "topic", "defaultValue": "Closures in JavaScript let functions remember the variables that existed in the surrounding scope when they were created." } },
    { "id": "lc",     "type": "loop-controller", "position": { "x": 320, "y": 60  }, "config": { "maxIterations": 5, "valueChannels": [{ "name": "text" }] } },
    { "id": "rev",    "type": "llm-call",        "position": { "x": 600, "y": 20  }, "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "Rewrite the user's text to be SHORTER and more accurate. Output ONLY the revised text — no commentary.", "temperature": 0.3, "maxTokens": null, "responseFormat": null } },
    { "id": "critic", "type": "llm-call",        "position": { "x": 600, "y": 200 }, "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "Critique the user's text. Respond ONLY with JSON: {\"good\": boolean, \"critique\": string}. `good` is true only if the text is technically accurate AND under 25 words.", "temperature": 0, "maxTokens": null, "responseFormat": "json_object" } },
    { "id": "parse",  "type": "transform",       "position": { "x": 900, "y": 200 }, "config": { "mode": "json-parse" } },
    { "id": "good",   "type": "transform",       "position": { "x": 1180,"y": 240 }, "config": { "mode": "json-path", "path": "good" } },
    { "id": "neg",    "type": "transform",       "position": { "x": 1180,"y": 320 }, "config": { "mode": "template", "template": "{{value}}" } },
    { "id": "out",    "type": "output",          "position": { "x": 1480,"y": 60  }, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e1",  "source": "in",     "sourceHandle": "value",        "target": "lc",     "targetHandle": "default-text" },
    { "id": "e2",  "source": "lc",     "sourceHandle": "output-text",  "target": "rev",    "targetHandle": "userMessage" },
    { "id": "e3",  "source": "rev",    "sourceHandle": "text",         "target": "critic", "targetHandle": "userMessage" },
    { "id": "e4",  "source": "rev",    "sourceHandle": "text",         "target": "lc",     "targetHandle": "input-text" },
    { "id": "e5",  "source": "critic", "sourceHandle": "text",         "target": "parse",  "targetHandle": "value" },
    { "id": "e6",  "source": "parse",  "sourceHandle": "result",       "target": "good",   "targetHandle": "value" },
    { "id": "e7",  "source": "good",   "sourceHandle": "result",       "target": "neg",    "targetHandle": "value" },
    { "id": "e8",  "source": "neg",    "sourceHandle": "result",       "target": "lc",     "targetHandle": "continue" },
    { "id": "e9",  "source": "lc",     "sourceHandle": "output-text",  "target": "out",    "targetHandle": "value" }
  ]
}
```

The "neg" Transform's template `{{value}}` renders a boolean as `"true"` or `"false"` — both non-empty strings, both truthy by our `isTruthy` rule. So this template by itself doesn't actually negate. We need a different approach to "halt when good=true." Instead use `regex-extract` so the Transform returns `null` when good=true and the literal `"false"` (truthy) when good=false:

Replace the `neg` Transform's config in the JSON above with:

```json
"config": { "mode": "regex-extract", "pattern": "false" }
```

(This regex matches the literal string "false". If `good=false` was emitted, the input is `"false"` — match returns `"false"` (truthy). If `good=true`, the input is `"true"` — no match, returns `null` (falsy). Wired to `lc.continue`, this halts when `good=true`.)

Apply that change inline to the `neg` node's `config` field in the JSON file. The final node becomes:

```json
{ "id": "neg", "type": "transform", "position": { "x": 1180, "y": 320 }, "config": { "mode": "regex-extract", "pattern": "false" } }
```

- [ ] **Step 4: RAG-lite**

Create `src/templates/data/04-rag-lite.graph.json`:

```json
{
  "schemaVersion": 1,
  "id": "tmpl-04-rag-lite",
  "name": "RAG-lite",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "updatedAt": "2026-05-02T00:00:00.000Z",
  "containsCustomCode": true,
  "nodes": [
    { "id": "in",   "type": "input",           "position": { "x": 40,  "y": 80  }, "config": { "name": "question", "defaultValue": "Summarize the homepage in two sentences." } },
    { "id": "url",  "type": "input",           "position": { "x": 40,  "y": 220 }, "config": { "name": "url", "defaultValue": "https://example.com" } },
    { "id": "tool", "type": "tool",            "position": { "x": 320, "y": 220 }, "config": { "name": "fetch_url", "description": "Fetch the text content of a URL.", "inputSchema": { "type": "object", "properties": { "url": { "type": "string" } }, "required": ["url"] }, "code": "const r = await helpers.fetch(inputs.url); return await r.text();", "timeoutMs": 30000 } },
    { "id": "tg",   "type": "tool-group",      "position": { "x": 600, "y": 220 }, "config": { "label": "fetcher" } },
    { "id": "ag",   "type": "agent",           "position": { "x": 900, "y": 80  }, "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "Use fetch_url to retrieve the page content, then answer the user's question.", "temperature": 0.3, "maxTokens": null, "maxIterations": 4, "stopCondition": "no-tool-calls" } },
    { "id": "tpl",  "type": "prompt-template", "position": { "x": 600, "y": 80  }, "config": { "template": "Question: {{q}}\n\nAvailable URL: {{u}}\n\nUse the fetch_url tool to retrieve the page, then answer." } },
    { "id": "out",  "type": "output",          "position": { "x": 1240,"y": 80  }, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e1", "source": "in",   "sourceHandle": "value", "target": "tpl", "targetHandle": "q" },
    { "id": "e2", "source": "url",  "sourceHandle": "value", "target": "tpl", "targetHandle": "u" },
    { "id": "e3", "source": "tpl",  "sourceHandle": "rendered", "target": "ag", "targetHandle": "userMessage" },
    { "id": "e4", "source": "tool", "sourceHandle": "toolDefinition", "target": "tg", "targetHandle": "tools" },
    { "id": "e5", "source": "tg",   "sourceHandle": "toolDefinition", "target": "ag", "targetHandle": "tools" },
    { "id": "e6", "source": "ag",   "sourceHandle": "text", "target": "out", "targetHandle": "value" }
  ]
}
```

- [ ] **Step 5: Raw ReAct Chat**

Create `src/templates/data/05-raw-react-chat.graph.json`:

```json
{
  "schemaVersion": 1,
  "id": "tmpl-05-raw-react-chat",
  "name": "Raw ReAct Agent (chat)",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "updatedAt": "2026-05-02T00:00:00.000Z",
  "containsCustomCode": true,
  "nodes": [
    { "id": "ci",   "type": "chat-input",      "position": { "x": 40,  "y": 60  }, "config": {} },
    { "id": "tadd", "type": "tool",            "position": { "x": 40,  "y": 240 }, "config": { "name": "add", "description": "Add two numbers.", "inputSchema": { "type": "object", "properties": { "a": { "type": "number" }, "b": { "type": "number" } }, "required": ["a", "b"] }, "code": "return inputs.a + inputs.b;", "timeoutMs": 30000 } },
    { "id": "tmul", "type": "tool",            "position": { "x": 40,  "y": 400 }, "config": { "name": "multiply", "description": "Multiply two numbers.", "inputSchema": { "type": "object", "properties": { "a": { "type": "number" }, "b": { "type": "number" } }, "required": ["a", "b"] }, "code": "return inputs.a * inputs.b;", "timeoutMs": 30000 } },
    { "id": "tg",   "type": "tool-group",      "position": { "x": 320, "y": 320 }, "config": { "label": "math tools" } },
    { "id": "lc",   "type": "loop-controller", "position": { "x": 600, "y": 60  }, "config": { "maxIterations": 6, "valueChannels": [{ "name": "messages" }] } },
    { "id": "llm",  "type": "llm-call",        "position": { "x": 940, "y": 40  }, "config": { "model": "openai/gpt-oss-120b:free", "systemPrompt": "You are a calculator that always uses the provided tools.", "temperature": 0, "maxTokens": null, "responseFormat": null } },
    { "id": "tr",   "type": "tool-runner",     "position": { "x": 1280,"y": 40  }, "config": {} },
    { "id": "last", "type": "transform",       "position": { "x": 1620,"y": 60  }, "config": { "mode": "json-path", "path": "[-1].content" } },
    { "id": "co",   "type": "chat-output",     "position": { "x": 1900,"y": 60  }, "config": { "format": "markdown" } }
  ],
  "edges": [
    { "id": "e01", "source": "ci",   "sourceHandle": "messages",       "target": "lc",   "targetHandle": "default-messages" },
    { "id": "e02", "source": "ci",   "sourceHandle": "userMessage",    "target": "llm",  "targetHandle": "userMessage" },
    { "id": "e03", "source": "tadd", "sourceHandle": "toolDefinition", "target": "tg",   "targetHandle": "tools" },
    { "id": "e04", "source": "tmul", "sourceHandle": "toolDefinition", "target": "tg",   "targetHandle": "tools" },
    { "id": "e05", "source": "tg",   "sourceHandle": "toolDefinition", "target": "llm",  "targetHandle": "tools" },
    { "id": "e06", "source": "tg",   "sourceHandle": "toolDefinition", "target": "tr",   "targetHandle": "tools" },
    { "id": "e07", "source": "lc",   "sourceHandle": "output-messages","target": "llm",  "targetHandle": "messages" },
    { "id": "e08", "source": "llm",  "sourceHandle": "toolCalls",      "target": "tr",   "targetHandle": "toolCalls" },
    { "id": "e09", "source": "llm",  "sourceHandle": "messages",       "target": "tr",   "targetHandle": "messages" },
    { "id": "e10", "source": "tr",   "sourceHandle": "messages",       "target": "lc",   "targetHandle": "input-messages" },
    { "id": "e11", "source": "llm",  "sourceHandle": "toolCalls",      "target": "lc",   "targetHandle": "continue" },
    { "id": "e12", "source": "lc",   "sourceHandle": "output-messages","target": "last", "targetHandle": "value" },
    { "id": "e13", "source": "last", "sourceHandle": "result",         "target": "co",   "targetHandle": "text" }
  ]
}
```

- [ ] **Step 6: Encapsulated Agent Chat**

Create `src/templates/data/06-encapsulated-agent-chat.graph.json`:

```json
{
  "schemaVersion": 1,
  "id": "tmpl-06-encapsulated-agent-chat",
  "name": "Encapsulated Agent (chat)",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "updatedAt": "2026-05-02T00:00:00.000Z",
  "containsCustomCode": true,
  "nodes": [
    { "id": "ci",   "type": "chat-input",  "position": { "x": 40,  "y": 60  }, "config": {} },
    { "id": "tadd", "type": "tool",        "position": { "x": 40,  "y": 240 }, "config": { "name": "add", "description": "Add two numbers.", "inputSchema": { "type": "object", "properties": { "a": { "type": "number" }, "b": { "type": "number" } }, "required": ["a", "b"] }, "code": "return inputs.a + inputs.b;", "timeoutMs": 30000 } },
    { "id": "tmul", "type": "tool",        "position": { "x": 40,  "y": 400 }, "config": { "name": "multiply", "description": "Multiply two numbers.", "inputSchema": { "type": "object", "properties": { "a": { "type": "number" }, "b": { "type": "number" } }, "required": ["a", "b"] }, "code": "return inputs.a * inputs.b;", "timeoutMs": 30000 } },
    { "id": "tg",   "type": "tool-group",  "position": { "x": 320, "y": 320 }, "config": { "label": "math tools" } },
    { "id": "ag",   "type": "agent",       "position": { "x": 600, "y": 80  }, "config": { "model": "openai/gpt-oss-120b:free", "systemPrompt": "You are a calculator that always uses the provided tools.", "temperature": 0, "maxTokens": null, "maxIterations": 6, "stopCondition": "no-tool-calls" } },
    { "id": "co",   "type": "chat-output", "position": { "x": 920, "y": 80  }, "config": { "format": "markdown" } }
  ],
  "edges": [
    { "id": "e1", "source": "ci",   "sourceHandle": "messages",       "target": "ag", "targetHandle": "messages" },
    { "id": "e2", "source": "ci",   "sourceHandle": "userMessage",    "target": "ag", "targetHandle": "userMessage" },
    { "id": "e3", "source": "tadd", "sourceHandle": "toolDefinition", "target": "tg", "targetHandle": "tools" },
    { "id": "e4", "source": "tmul", "sourceHandle": "toolDefinition", "target": "tg", "targetHandle": "tools" },
    { "id": "e5", "source": "tg",   "sourceHandle": "toolDefinition", "target": "ag", "targetHandle": "tools" },
    { "id": "e6", "source": "ag",   "sourceHandle": "text",           "target": "co", "targetHandle": "text" }
  ]
}
```

- [ ] **Step 7: Templates index**

Create `src/templates/index.ts`:

```ts
import type { Graph } from '@/domain/graph';
import t01 from './data/01-hello-model.graph.json';
import t02 from './data/02-two-model-comparison.graph.json';
import t03 from './data/03-self-critique-fixed.graph.json';
import t04 from './data/04-rag-lite.graph.json';
import t05 from './data/05-raw-react-chat.graph.json';
import t06 from './data/06-encapsulated-agent-chat.graph.json';

export interface BundledTemplate {
  id: string;
  name: string;
  description: string;
  graph: Graph;
}

export const TEMPLATES: BundledTemplate[] = [
  { id: 'hello-model', name: 'Hello Model', description: 'The simplest run: Input → LLM Call → Output.', graph: t01 as unknown as Graph },
  { id: 'two-model-comparison', name: 'Two-Model Comparison', description: 'Same prompt, two models side by side.', graph: t02 as unknown as Graph },
  { id: 'self-critique', name: 'Self-Critique Loop', description: 'Reviser + Critic with conditional halt via Transform.', graph: t03 as unknown as Graph },
  { id: 'rag-lite', name: 'RAG-lite', description: 'Fetch a URL, prompt-template the question, agent answers.', graph: t04 as unknown as Graph },
  { id: 'raw-react-chat', name: 'Raw ReAct (chat)', description: 'Full ReAct loop unrolled: LC + LLM + Tool Runner.', graph: t05 as unknown as Graph },
  { id: 'encapsulated-agent-chat', name: 'Encapsulated Agent (chat)', description: 'Same behavior as raw ReAct, but with the Agent node.', graph: t06 as unknown as Graph },
];
```

- [ ] **Step 8: Modal**

Create `src/components/TemplatePickerModal.vue`:

```vue
<script setup lang="ts">
import { TEMPLATES, type BundledTemplate } from '@/templates';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; pick: [tpl: BundledTemplate] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center"
    @click.self="emit('close')"
  >
    <div class="bg-panel-strong border border-border-strong rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
      <div class="px-4 py-3 border-b border-border-base flex items-center justify-between">
        <strong>New from Template</strong>
        <button type="button" @click="emit('close')" class="text-text-dim hover:text-text-base text-xl leading-none">×</button>
      </div>
      <ul class="flex-1 overflow-y-auto p-2">
        <li
          v-for="tpl in TEMPLATES"
          :key="tpl.id"
          @click="emit('pick', tpl)"
          class="px-3 py-2 rounded cursor-pointer hover:bg-elev"
        >
          <div class="font-medium text-sm">{{ tpl.name }}</div>
          <div class="text-text-dim text-xs">{{ tpl.description }}</div>
        </li>
      </ul>
      <div class="px-4 py-2 border-t border-border-base text-[11px] opacity-60">
        Picking a template loads it into a new untitled graph. Save As to give it a real location before running.
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 9: Toolbar button**

Modify `src/components/Toolbar.vue`. Find the existing button group (look for `<button` elements; the file already has Run/Stop/Save/Open buttons). Add a `Templates` button next to "Open":

```ts
import { ref } from 'vue';
import TemplatePickerModal from './TemplatePickerModal.vue';
import { useGraphStore } from '@/stores/graph';
import type { BundledTemplate } from '@/templates';

const graph = useGraphStore();
const templatesOpen = ref(false);

function onPick(tpl: BundledTemplate) {
  // Clone via JSON round-trip so subsequent edits don't mutate the bundle.
  const cloned = JSON.parse(JSON.stringify(tpl.graph));
  // Each instance needs unique node ids so reopening templates doesn't collide.
  // (Cheapest fix: keep template ids; Vue Flow tolerates duplicates across separate
  //  graph instances. If a clash surfaces, regenerate ids here with crypto.randomUUID().)
  graph.load(cloned, null);  // null = untitled — user must Save As before running
  templatesOpen.value = false;
}
```

In the template, add the button (style consistent with existing toolbar buttons — match the existing class strings):

```vue
<button type="button" @click="templatesOpen = true" class="<existing-toolbar-button-class>">
  Templates
</button>
<TemplatePickerModal :open="templatesOpen" @close="templatesOpen = false" @pick="onPick" />
```

Read the existing `Toolbar.vue` first to copy the button styling exactly. Read `src/stores/graph.ts` to confirm the `load(graph, filePath)` method's signature; if it differs (e.g. takes only the graph and infers untitled state), adapt the call.

- [ ] **Step 10: Configure Vite to import `*.graph.json` as JSON**

Run: `grep -n "json\\|assetsInclude" vite.config.ts`. Vite imports `.json` files as JSON by default; no config change usually needed. If `tsconfig.json` has `resolveJsonModule` already set (which it does in Vite-default templates), `import t01 from './data/...graph.json'` works out-of-the-box.

If typecheck fails with "Cannot find module" errors on the JSON imports, add `"resolveJsonModule": true` to `tsconfig.app.json`'s `compilerOptions` (it's likely already present).

- [ ] **Step 11: Verify**

Run: `npm run typecheck && npm run test:run`
Expected: clean, 92 tests still pass.

Manual smoke (recommended): `npm run dev`, click the new "Templates" toolbar button, pick "Hello Model" — should load 3 nodes wired Input→LLM→Output.

- [ ] **Step 12: Commit**

```bash
git add src/templates/ src/components/TemplatePickerModal.vue src/components/Toolbar.vue
git commit -m "feat(templates): bundled starter graphs + New from Template modal"
```

---

## Task 10: Rewrite the on-disk `test3-self-critique.graph.json` to use Transform-driven halt

The fixed-N refinement version we shipped during Plan 3 is documented as a "fixed-N demo" in the spec. With Transform now available, replace it with the proper conditional-halt version (effectively a copy of bundled template 03 but saved as a runnable graph file).

**Files:**
- Modify: `graphs/test3-self-critique.graph.json`

- [ ] **Step 1: Replace the file contents**

Open `graphs/test3-self-critique.graph.json` and replace its entire contents with the same JSON used in Task 9 Step 3 (`src/templates/data/03-self-critique-fixed.graph.json` — including the regex-extract trick on the `neg` node).

```json
{
  "schemaVersion": 1,
  "id": "11111111-aaaa-4111-aaaa-111111111111",
  "name": "test3-self-critique",
  "createdAt": "2026-05-02T14:00:00.000Z",
  "updatedAt": "2026-05-02T14:00:00.000Z",
  "containsCustomCode": false,
  "nodes": [
    { "id": "in",     "type": "input",           "position": { "x": 40,  "y": 60  }, "config": { "name": "topic", "defaultValue": "Closures in JavaScript let functions remember the variables that existed in the surrounding scope when they were created." } },
    { "id": "lc",     "type": "loop-controller", "position": { "x": 320, "y": 60  }, "config": { "maxIterations": 5, "valueChannels": [{ "name": "text" }] } },
    { "id": "rev",    "type": "llm-call",        "position": { "x": 600, "y": 20  }, "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "Rewrite the user's text to be SHORTER and more accurate. Output ONLY the revised text — no commentary.", "temperature": 0.3, "maxTokens": null, "responseFormat": null } },
    { "id": "critic", "type": "llm-call",        "position": { "x": 600, "y": 200 }, "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "Critique the user's text. Respond ONLY with JSON: {\"good\": boolean, \"critique\": string}. `good` is true only if the text is technically accurate AND under 25 words.", "temperature": 0, "maxTokens": null, "responseFormat": "json_object" } },
    { "id": "parse",  "type": "transform",       "position": { "x": 900, "y": 200 }, "config": { "mode": "json-parse" } },
    { "id": "good",   "type": "transform",       "position": { "x": 1180,"y": 240 }, "config": { "mode": "json-path", "path": "good" } },
    { "id": "neg",    "type": "transform",       "position": { "x": 1180,"y": 320 }, "config": { "mode": "regex-extract", "pattern": "false" } },
    { "id": "out",    "type": "output",          "position": { "x": 1480,"y": 60  }, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e1",  "source": "in",     "sourceHandle": "value",        "target": "lc",     "targetHandle": "default-text" },
    { "id": "e2",  "source": "lc",     "sourceHandle": "output-text",  "target": "rev",    "targetHandle": "userMessage" },
    { "id": "e3",  "source": "rev",    "sourceHandle": "text",         "target": "critic", "targetHandle": "userMessage" },
    { "id": "e4",  "source": "rev",    "sourceHandle": "text",         "target": "lc",     "targetHandle": "input-text" },
    { "id": "e5",  "source": "critic", "sourceHandle": "text",         "target": "parse",  "targetHandle": "value" },
    { "id": "e6",  "source": "parse",  "sourceHandle": "result",       "target": "good",   "targetHandle": "value" },
    { "id": "e7",  "source": "good",   "sourceHandle": "result",       "target": "neg",    "targetHandle": "value" },
    { "id": "e8",  "source": "neg",    "sourceHandle": "result",       "target": "lc",     "targetHandle": "continue" },
    { "id": "e9",  "source": "lc",     "sourceHandle": "output-text",  "target": "out",    "targetHandle": "value" }
  ]
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck && npm run test:run`
Expected: still 92 passing.

```bash
git add graphs/test3-self-critique.graph.json
git commit -m "feat(examples): test3 uses Transform for conditional halt (good=true)"
```

---

## Task 11: Spec milestone note + README update

**Files:**
- Modify: `docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md` (append a "Plan 4 implementation notes" section at the end of §20)
- Modify: `README.md` (Plan 4 milestone + features)

- [ ] **Step 1: Append Plan 4 implementation notes**

Find the "Implementation notes" section in the spec (look for the existing "Plan 1 / Plan 2 / Plan 3 implementation notes" subsections). Append:

```markdown
### Plan 4 (Chat & Templates)

- **Transform node** — five modes (`json-parse`, `json-stringify`, `json-path`, `regex-extract`, `template`). The `json-path` syntax supports dot keys and `[n]` array indexes (negative indexes count from the end). The `regex-extract` mode returns `null` on no match — useful as the falsy halt-signal trick demonstrated in `test3-self-critique` (regex `"false"` against the critic's `good` boolean: matches falsy → continue, no match truthy → halt).
- **Prompt Template node** — uses the same `{{var}}` syntax + extractor as the Transform's `template` mode (see `src/nodes/_internals/template-vars.ts`). Input ports are dynamic — port-types resolves them by re-scanning `cfg.template` at connection time.
- **Chat Input / Chat Output** — Chat Input has zero static inputs and reads its outputs (`userMessage`, `messages`) from `ctx.chatSession`, which the runner injects when `RunGraphArgs.chatSession` is set. If the graph is run from the toolbar (not the chat sidebar), Chat Input throws with a clear message. Chat Output stores its `text` input on `result.details.value` for the sidebar to read after the run completes.
- **Chat sidebar (`useChatStore`)** — in-memory thread of `{role, content}`. On submit, it builds a `ChatMessage[]` history, calls `runGraph(graph, apiKey, chatSession)`, and reads the chat-output node's `details.value` as the assistant reply. Errors surface as `Error: <message>` assistant turns. No persistence beyond per-run.
- **`isChatActive`** — left tab swap is gated on the graph having exactly one `chat-input` AND exactly one `chat-output`. Anything else → placeholder.
- **Bundled templates** — six starter graphs in `src/templates/data/`, surfaced via the Toolbar's "Templates" button. Each is cloned via `JSON.parse(JSON.stringify(...))` on selection and loaded as untitled — the user must Save As before running.
- **`test3-self-critique` rewritten** — uses Transform (`json-parse → json-path "good" → regex-extract "false"`) to halt on the critic's verdict instead of fixed-N max-iter. Demonstrates the proper Loop Controller + Transform pattern.
```

- [ ] **Step 2: Update README**

Find the "Status" section in `README.md`. Add a Plan 4 entry mirroring the Plan 1/2/3 entries, and append a "Plan 4 features" section:

```markdown
Plan 4 (Chat & Templates) — runnable. Transform and Prompt Template nodes plus Chat Input + Chat Output complete the v1 node set; the left sidebar becomes a real chat interface when the graph is chat-active. Six bundled starter graphs are accessible via the Templates button.
```

```markdown
### Plan 4 features

- **Transform** node — `json-parse`, `json-stringify`, `json-path`, `regex-extract`, `template` modes
- **Prompt Template** node — string template with `{{var}}` placeholders; one input port per discovered variable
- **Chat Input** + **Chat Output** nodes — bind to the chat sidebar
- **Chat sidebar** — when the open graph has exactly one Chat Input + one Chat Output, the left sidebar swaps to a real chat thread; each submission triggers a Run
- **Bundled templates** — six starter graphs accessible via the Templates toolbar button: Hello Model, Two-Model Comparison, Self-Critique Loop (with conditional halt), RAG-lite, Raw ReAct Chat, Encapsulated Agent Chat
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md README.md
git commit -m "docs(spec): Plan 4 implementation notes (Chat & Templates)"
```

---

## Self-Review Notes

**Spec coverage:**
- §6.7 Prompt Template — Tasks 4, 5
- §6.8 Transform — Tasks 2, 3
- §6.12 Chat Input — Tasks 6, 7
- §6.13 Chat Output — Tasks 6, 7
- §9 Chat Sidebar — Task 8
  - §9.1 Activation — `useChatStore.isChatActive` + `LeftTabs` gate
  - §9.2 Behavior — `submit()` flow
  - §9.3 Run history relationship — each turn = one Run (already true via `runGraph`)
  - §9.4 UI — `ChatPanel` + `ChatBubble`, scroller, "Clear" button, running indicator. **Streaming into the assistant bubble is NOT implemented in this plan** — see Notable Risks.
  - §9.5 Out of scope items — explicitly out of scope
- §13 Templates — Task 9 (bundled JSON files + modal + toolbar button)

**Type consistency:**
- `ChatSession` is defined once in `src/nodes/registry.ts` and consumed by `runner.ts`, `loop-driver.ts`, `chat-input.ts`, `chat.ts` — no shape drift.
- `ChatTurn` (`{ role: 'user' | 'assistant'; content: string }`) is the sidebar's local shape, distinct from `ChatMessage` (which has `tool_call_id`, `name`, etc.). The `submit()` flow maps from one to the other.
- `BundledTemplate` is the templates-index shape; the loaded `Graph` types are exactly the existing `Graph` from `domain/graph.ts`.
- All node config types (`TransformConfig`, `PromptTemplateConfig`, `ChatInputConfig`, `ChatOutputConfig`) are added to the `NodeConfig` union in Task 2/4/6 — order: Transform, PromptTemplate, ChatInput, ChatOutput, before LoopControllerConfig.

**Placeholder scan:** no `TBD` / `TODO` / "implement later" / "appropriate error handling" left. The "the regex-extract trick" technique in Task 9 Step 3 is documented inline with a worked example showing exactly which input produces which output.

**Notable risks:**
1. **Streaming into the assistant bubble is not implemented.** Spec §9.4 says "Streaming tokens from the Chat Output's upstream LLM Call appear progressively in the assistant bubble." This plan ships the simpler "running… then full reply" UX. Adding streaming requires the chat panel to (a) trace the chat-output's upstream node graph backward to find the streaming source (LLM Call or Agent), and (b) read `runStore.livePreviews[that-id]` reactively during the running window. Both are doable but add 30+ lines and a new edge of complexity. **Recommendation:** ship without streaming, add as a follow-up if it bothers anyone.
2. **Template id collisions.** When a user picks the same template twice, Vue Flow gets two graphs with identical node ids. Vue Flow tolerates this in separate graph instances (each load replaces the canvas). If users tab between two open template instances, ids would clash — but the app doesn't support tabbed graphs in v1, so this is fine. Task 9 Step 9 has a note with a one-line escape hatch (`crypto.randomUUID()` rewriting on clone) if it ever surfaces.
3. **Self-critique `regex-extract "false"` trick.** It works, but it's clever-syntax that someone reading the graph won't immediately grok. The bundled template's description should mention the trick so users can study it. (Task 9 Step 7 description says "with conditional halt via Transform" — adequate; the spec note in Task 11 is the deeper explanation.)
4. **Chat Output's `details.value` is the only contract.** If a future change to the Output node's `details` shape (e.g. nesting under `details.output.value`) lands, the chat sidebar's `submit()` will silently read `undefined` and append `(no reply)`. Consider making the chat-output's run() also write to a more stable field — but for v1 simplicity, `details.value` mirrors the existing Output node's pattern, so this risk is uniform across the codebase.
