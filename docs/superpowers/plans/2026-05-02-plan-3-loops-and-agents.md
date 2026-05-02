# Plan 3 — Loops & Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cycle support to the execution engine via a Loop Controller node + Break exit, plus an Agent convenience node, so users can build ReAct-style loops, retry/refinement loops, and any iterative pattern with full per-iteration introspection.

**Architecture:** A pre-run validator allows back-edges *only* if they terminate at a `loop-controller` node. The runner walks a topological order computed with back-edges removed; when it reaches a Loop Controller, it drives the loop body manually — re-running each body node once per iteration and recording an `IterationRecord` per pass. A `break` node sits at the loop's exit and stays parked until the controller signals termination. The `agent` node packages the LLMCall ↔ ToolRunner pattern as a single node by reusing extracted helpers from those node types — the same building blocks, no parallel implementation.

**Tech Stack:** TypeScript strict, Vue 3 + Composition API + `<script setup>`, Pinia, Vue Flow for the canvas, Vitest for tests, Web Workers for the existing tool sandbox (unchanged in this plan).

---

## File Structure

**New engine files**
- `src/engine/loop-validation.ts` — back-edge detection + Loop Controller anchoring rule
- `src/engine/loop-driver.ts` — per-Loop Controller iteration driver (state propagation, per-iteration record capture, halt logic)

**New node definitions**
- `src/nodes/loop-controller.ts` — LoopController node (the cycle anchor; mostly a port-shape declaration; the actual iteration is driven by the loop-driver)
- `src/nodes/break.ts` — Break node (passthrough; firing gated by its parent controller)
- `src/nodes/agent.ts` — Agent node (inline loop using shared helpers)
- `src/nodes/_internals/llm-once.ts` — extracted single-turn LLM call (reused by `llm-call.ts` and `agent.ts`)
- `src/nodes/_internals/tool-batch.ts` — extracted batched tool execution (reused by `tool-runner.ts` and `agent.ts`)

**New UI files**
- `src/components/nodes/LoopControllerNode.vue`
- `src/components/nodes/BreakNode.vue`
- `src/components/nodes/AgentNode.vue`
- `src/components/inspectors/LoopControllerInspector.vue`
- `src/components/inspectors/BreakInspector.vue`
- `src/components/inspectors/AgentInspector.vue`
- `src/components/inspectors/IterationTree.vue` — shared collapsible iteration list, used by LoopController + Agent inspectors and by LLMCallInspector when a node is inside a loop

**Modified files**
- `src/domain/node-types.ts` — add `LoopControllerConfig`, `AgentConfig` to the union
- `src/engine/scheduler.ts` — relax `topologicalOrder` to skip back-edges; expose a new helper `topologicalOrderIgnoringBackEdges`
- `src/engine/runner.ts` — handle Loop Controller / Break / Agent specifically; record `IterationRecord[]` on the body nodes
- `src/nodes/port-types.ts` — declare port types for the three new node types (dynamic for Loop Controller channels)
- `src/nodes/llm-call.ts` — refactor to use the extracted `llmOnce` helper
- `src/nodes/tool-runner.ts` — refactor to use the extracted `runToolBatch` helper
- `src/nodes/registry.ts` — no schema change; just three new registrations
- `src/components/Canvas.vue` — register the three new node Vue components in `nodeTypes`; allow back-edges in `isValidConnection`
- `src/components/AddNodeMenu.vue` — three new menu entries with default configs
- `src/components/inspectors/InspectorRouter.vue` (or wherever the inspector switch lives — likely `RightPanel.vue`) — wire the three new inspectors
- `src/components/inspectors/LLMCallInspector.vue` — show iteration selector when result has `iterations`

**New test files**
- `tests/engine/loop-validation.spec.ts`
- `tests/engine/loop-driver.spec.ts`
- `tests/nodes/loop-controller.spec.ts`
- `tests/nodes/agent.spec.ts`

**New example graphs**
- `graphs/test3-self-critique.graph.json` — self-critique loop demo
- `graphs/test4-react-agent.graph.json` — raw ReAct loop (LC + LLMCall + ToolRunner + Break)
- `graphs/test5-agent-node.graph.json` — same behavior as test4 using the encapsulated Agent node

---

## Glossary (to keep names consistent across tasks)

- **Back-edge:** an edge `e` is a back-edge iff `target(e)` precedes `source(e)` in the back-edge-free topological order. Equivalently: it points "upward" in the DAG.
- **Loop body:** the set of nodes reachable from a Loop Controller's outputs and on a path that reaches some back-edge whose target is that Loop Controller.
- **Channel:** a named state slot declared by a Loop Controller. Each channel `<name>` produces three ports: `default-<name>` (target), `input-<name>` (target, the back-edge landing), `output-<name>` (source).
- **Iteration:** one full execution of all body nodes between an entry to the Loop Controller and the next decision point on `continue`.
- **`IterationRecord`:** the existing type in `src/domain/run.ts` (`iteration: number; startedAt; endedAt?; inputs; output?; details?`).

---

## Task 1: Loop validation — back-edges allowed only via Loop Controller

**Files:**
- Create: `src/engine/loop-validation.ts`
- Create: `tests/engine/loop-validation.spec.ts`
- Modify: `src/engine/scheduler.ts` (add a helper that returns topo order ignoring back-edges)

- [ ] **Step 1: Write failing tests**

Create `tests/engine/loop-validation.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findBackEdges, validateLoopTopology } from '@/engine/loop-validation';
import type { Graph, Node, Edge } from '@/domain/graph';

function n(id: string, type: Node['type'] = 'input'): Node {
  return { id, type, position: { x: 0, y: 0 }, config: {} };
}
function e(id: string, source: string, target: string, sourceHandle = 'value', targetHandle = 'value'): Edge {
  return { id, source, sourceHandle, target, targetHandle };
}
function g(nodes: Node[], edges: Edge[]): Graph {
  return { schemaVersion: 1, id: 'g', name: 'g', createdAt: '', updatedAt: '', nodes, edges, containsCustomCode: false };
}

describe('findBackEdges', () => {
  it('returns [] for an acyclic graph', () => {
    const graph = g([n('a'), n('b'), n('c')], [e('1', 'a', 'b'), e('2', 'b', 'c')]);
    expect(findBackEdges(graph)).toEqual([]);
  });

  it('finds the back-edge in a simple cycle', () => {
    const graph = g(
      [n('a'), n('lc', 'loop-controller'), n('body')],
      [e('1', 'a', 'lc'), e('2', 'lc', 'body'), e('3', 'body', 'lc')],
    );
    const back = findBackEdges(graph);
    expect(back.map((x) => x.id)).toEqual(['3']);
  });
});

describe('validateLoopTopology', () => {
  it('passes for an acyclic graph', () => {
    const graph = g([n('a'), n('b')], [e('1', 'a', 'b')]);
    expect(() => validateLoopTopology(graph)).not.toThrow();
  });

  it('passes when every back-edge targets a loop-controller', () => {
    const graph = g(
      [n('a'), n('lc', 'loop-controller'), n('body')],
      [e('1', 'a', 'lc'), e('2', 'lc', 'body'), e('3', 'body', 'lc')],
    );
    expect(() => validateLoopTopology(graph)).not.toThrow();
  });

  it('throws when a back-edge targets a non-controller node', () => {
    const graph = g(
      [n('a'), n('b'), n('c')],
      [e('1', 'a', 'b'), e('2', 'b', 'c'), e('3', 'c', 'b')],
    );
    expect(() => validateLoopTopology(graph)).toThrow(/Loop Controller/i);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npm run test:run -- tests/engine/loop-validation.spec.ts`
Expected: FAIL with "Cannot find module '@/engine/loop-validation'".

- [ ] **Step 3: Implement the validator**

Create `src/engine/loop-validation.ts`:

```ts
import type { Graph, Edge } from '@/domain/graph';

/**
 * Computes a topological order using only forward edges, treating any edge
 * that would require visiting an unvisited cycle as a back-edge to skip.
 *
 * Algorithm: DFS with white/gray/black marks. An edge (u, v) where v is gray
 * (currently on the stack) is a back-edge.
 */
export function findBackEdges(graph: Graph): Edge[] {
  const adj = new Map<string, Edge[]>();
  for (const node of graph.nodes) adj.set(node.id, []);
  for (const edge of graph.edges) adj.get(edge.source)?.push(edge);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const node of graph.nodes) color.set(node.id, WHITE);

  const back: Edge[] = [];

  function visit(id: string) {
    color.set(id, GRAY);
    for (const edge of adj.get(id) ?? []) {
      const c = color.get(edge.target);
      if (c === GRAY) back.push(edge);
      else if (c === WHITE) visit(edge.target);
    }
    color.set(id, BLACK);
  }

  for (const node of graph.nodes) {
    if (color.get(node.id) === WHITE) visit(node.id);
  }
  return back;
}

/**
 * Throws if any back-edge in the graph targets a node that is not a
 * `loop-controller`. Acyclic graphs always pass.
 */
export function validateLoopTopology(graph: Graph): void {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const back = findBackEdges(graph);
  for (const edge of back) {
    const target = nodeById.get(edge.target);
    if (!target || target.type !== 'loop-controller') {
      throw new Error(
        `Cycle through edge "${edge.id}" (${edge.source} → ${edge.target}) is not allowed: ` +
        `the only nodes that may receive back-edges are Loop Controllers.`,
      );
    }
  }
}
```

- [ ] **Step 4: Add a topo helper that ignores back-edges (used by runner)**

Modify `src/engine/scheduler.ts`. Add this export at the bottom (do NOT remove `topologicalOrder`):

```ts
import { findBackEdges } from './loop-validation';

/**
 * Same as topologicalOrder, but tolerates back-edges that target Loop Controllers
 * — those edges are removed from the graph for ordering purposes. The runner uses
 * this order; the loop-driver re-runs body nodes for additional iterations.
 */
export function topologicalOrderIgnoringBackEdges(graph: Graph): string[] {
  const back = new Set(findBackEdges(graph).map((e) => e.id));
  const filteredEdges = graph.edges.filter((e) => !back.has(e.id));
  return topologicalOrder({ ...graph, edges: filteredEdges });
}
```

- [ ] **Step 5: Run the tests, verify they pass**

Run: `npm run test:run -- tests/engine/loop-validation.spec.ts`
Expected: PASS (3 tests).

Run the full suite to make sure nothing regressed: `npm run test:run`
Expected: 33 passing (existing 30 + 3 new).

- [ ] **Step 6: Commit**

```bash
git add src/engine/loop-validation.ts src/engine/scheduler.ts tests/engine/loop-validation.spec.ts
git commit -m "feat(engine): back-edge detection + loop topology validator"
```

---

## Task 2: Domain types — Loop Controller and Agent configs

**Files:**
- Modify: `src/domain/node-types.ts`

- [ ] **Step 1: Add the new config interfaces and extend the union**

Modify `src/domain/node-types.ts`. Add these interfaces just before the `NodeConfig` union, and add them to the union:

```ts
export interface LoopControllerConfig {
  maxIterations: number;            // default 25
  valueChannels: Array<{ name: string }>;  // declared state channels
}

export interface BreakConfig {
  // intentionally empty — Break is a passthrough
}

export interface AgentConfig {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number | null;
  maxIterations: number;            // default 25
  stopCondition: 'no-tool-calls';   // only option in v1
}
```

And update the union:

```ts
export type NodeConfig =
  | InputConfig
  | OutputConfig
  | LLMCallConfig
  | ToolConfig
  | ToolGroupConfig
  | ToolRunnerConfig
  | LoopControllerConfig
  | BreakConfig
  | AgentConfig
  | Record<string, unknown>;
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). The full test suite should still pass too: `npm run test:run` → 33 passing.

- [ ] **Step 3: Commit**

```bash
git add src/domain/node-types.ts
git commit -m "feat(domain): LoopControllerConfig + AgentConfig types"
```

---

## Task 3: Port-types for the three new node types

**Files:**
- Modify: `src/nodes/port-types.ts`

The Loop Controller's ports are *dynamic* — one set per declared channel. Both source-side and target-side resolvers must consult the node's config.

- [ ] **Step 1: Update port-types**

Modify `src/nodes/port-types.ts`. In `getSourcePortType` add:

```ts
    case 'loop-controller': {
      // output-<name> ports — type is opaque (`json`) since channels carry arbitrary values
      const cfg = node.config as { valueChannels?: Array<{ name: string }> };
      if (handleId === 'iteration') return 'string';
      if (handleId.startsWith('output-')) {
        const name = handleId.slice('output-'.length);
        if (cfg.valueChannels?.some((c) => c.name === name)) return 'json';
      }
      return null;
    }
    case 'break':
      if (handleId === 'value') return 'json';
      return null;
    case 'agent':
      if (handleId === 'text') return 'string';
      if (handleId === 'messages') return 'messages';
      if (handleId === 'iterationCount') return 'string';
      return null;
```

In `getTargetPortType` add:

```ts
    case 'loop-controller': {
      const cfg = node.config as { valueChannels?: Array<{ name: string }> };
      if (handleId === 'continue') return 'json';
      if (handleId.startsWith('default-')) {
        const name = handleId.slice('default-'.length);
        if (cfg.valueChannels?.some((c) => c.name === name)) return 'json';
      }
      if (handleId.startsWith('input-')) {
        const name = handleId.slice('input-'.length);
        if (cfg.valueChannels?.some((c) => c.name === name)) return 'json';
      }
      return null;
    }
    case 'break':
      if (handleId === 'value') return 'json';
      return null;
    case 'agent':
      if (handleId === 'userMessage') return 'string';
      if (handleId === 'messages') return 'messages';
      if (handleId === 'tools') return 'tools';
      return null;
```

- [ ] **Step 2: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/nodes/port-types.ts
git commit -m "feat(ports): loop-controller / break / agent port types"
```

---

## Task 4: Loop Controller node definition (engine stub)

The Loop Controller's `run()` is mostly a passthrough — the *real* iteration logic lives in the loop-driver added later. The `run()` here just returns initial output values and asserts on its config. The driver re-invokes it across iterations by directly calling its `run()` with new inputs.

**Files:**
- Create: `src/nodes/loop-controller.ts`
- Create: `tests/nodes/loop-controller.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/nodes/loop-controller.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loopControllerNode } from '@/nodes/loop-controller';
import type { Node } from '@/domain/graph';

function makeNode(channels: string[], maxIterations = 25): Node {
  return {
    id: 'lc',
    type: 'loop-controller',
    position: { x: 0, y: 0 },
    config: {
      maxIterations,
      valueChannels: channels.map((name) => ({ name })),
    },
  };
}

const ctx = {
  signal: new AbortController().signal,
  details: {} as Record<string, unknown>,
  apiKey: '',
};

describe('loopControllerNode', () => {
  it('emits output-<name> from default-<name> on first invocation', async () => {
    const node = makeNode(['draft']);
    const inputs = { 'default-draft': 'hello', 'iteration': 1 };
    const out = await loopControllerNode.run(node, inputs, ctx);
    expect(out['output-draft']).toBe('hello');
    expect(out['iteration']).toBe(1);
  });

  it('emits output-<name> from input-<name> on subsequent invocation', async () => {
    const node = makeNode(['draft']);
    const inputs = { 'default-draft': 'first', 'input-draft': 'second', 'iteration': 2 };
    const out = await loopControllerNode.run(node, inputs, ctx);
    expect(out['output-draft']).toBe('second');
    expect(out['iteration']).toBe(2);
  });

  it('throws if maxIterations is missing or non-positive', async () => {
    const bad: Node = { ...makeNode(['x'], 0) };
    await expect(loopControllerNode.run(bad, { 'default-x': 1, iteration: 1 }, ctx))
      .rejects.toThrow(/maxIterations/);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npm run test:run -- tests/nodes/loop-controller.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the node**

Create `src/nodes/loop-controller.ts`:

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LoopControllerConfig } from '@/domain/node-types';

export const loopControllerNode: NodeDefinition = {
  type: 'loop-controller',
  // The port lists are *static names*; channel-suffixed ports are validated by
  // port-types.ts at connection time and resolved dynamically by the runner.
  inputPorts: ['continue'],
  outputPorts: ['iteration'],
  async run(node, inputs) {
    const cfg = node.config as LoopControllerConfig;
    if (!cfg.maxIterations || cfg.maxIterations < 1) {
      throw new Error('Loop Controller: maxIterations must be a positive integer');
    }
    const channels = cfg.valueChannels ?? [];
    const iteration = (inputs.iteration as number | undefined) ?? 1;
    const outputs: Record<string, unknown> = { iteration };
    for (const ch of channels) {
      const cycled = inputs[`input-${ch.name}`];
      const initial = inputs[`default-${ch.name}`];
      // Iteration 1: emit defaults. Subsequent: emit cycled value if provided, else fall back to default.
      outputs[`output-${ch.name}`] = iteration === 1
        ? initial
        : (cycled !== undefined ? cycled : initial);
    }
    return outputs;
  },
};

registerNodeDefinition(loopControllerNode);
```

- [ ] **Step 4: Register the module so it self-registers**

Find where node definitions are imported (search for `registerNodeDefinition` callers — they're imported from a central place such as `src/nodes/index.ts` or `src/main.ts`). Add an import for `./loop-controller`.

Run: `grep -n "import.*nodes/" src/main.ts src/nodes/*.ts` — find the import barrel and add:

```ts
import './loop-controller';
```

(If a `src/nodes/index.ts` barrel exists, add it there alongside `tool.ts`, `tool-runner.ts`, etc.)

- [ ] **Step 5: Run the tests, verify they pass**

Run: `npm run test:run -- tests/nodes/loop-controller.spec.ts`
Expected: PASS (3 tests). Full suite: `npm run test:run` → 36 passing.

- [ ] **Step 6: Commit**

```bash
git add src/nodes/loop-controller.ts tests/nodes/loop-controller.spec.ts src/main.ts
git commit -m "feat(node): loop-controller node definition"
```

---

## Task 5: Break node definition

**Files:**
- Create: `src/nodes/break.ts`

The Break node is a passthrough at the node level. The runner is responsible for *parking* it until its parent loop terminates — that logic lives in the loop-driver (Task 6).

- [ ] **Step 1: Write the implementation**

Create `src/nodes/break.ts`:

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';

export const breakNode: NodeDefinition = {
  type: 'break',
  inputPorts: ['value'],
  outputPorts: ['value'],
  async run(_node, inputs) {
    return { value: inputs.value };
  },
};

registerNodeDefinition(breakNode);
```

- [ ] **Step 2: Register the module**

Add to the same import barrel as Task 4 step 4:

```ts
import './break';
```

- [ ] **Step 3: Run the typecheck and tests**

Run: `npm run typecheck && npm run test:run`
Expected: PASS, 36 passing.

- [ ] **Step 4: Commit**

```bash
git add src/nodes/break.ts src/main.ts
git commit -m "feat(node): break node definition"
```

---

## Task 6: Loop driver — iteration scheduling

This is the core of Plan 3. The runner's existing single-pass loop is split: when it would otherwise reach a Loop Controller, it hands off to the driver, which determines the loop body, runs it for `iteration=1` with default channel values, then re-runs it for additional iterations using the back-edge values, until `continue` is falsy or `maxIterations` is hit.

**Files:**
- Create: `src/engine/loop-driver.ts`
- Create: `tests/engine/loop-driver.spec.ts`
- Modify: `src/engine/runner.ts`

- [ ] **Step 1: Write failing tests for body-detection helpers**

Create `tests/engine/loop-driver.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeLoopBody } from '@/engine/loop-driver';
import type { Graph, Node, Edge } from '@/domain/graph';

function n(id: string, type: Node['type']): Node {
  return { id, type, position: { x: 0, y: 0 }, config: {} };
}
function e(id: string, source: string, target: string, sh = 'value', th = 'value'): Edge {
  return { id, source, sourceHandle: sh, target, targetHandle: th };
}
function g(nodes: Node[], edges: Edge[]): Graph {
  return { schemaVersion: 1, id: 'g', name: 'g', createdAt: '', updatedAt: '', nodes, edges, containsCustomCode: false };
}

describe('computeLoopBody', () => {
  it('returns nodes between LC outputs and the back-edge', () => {
    const graph = g(
      [n('input', 'input'), n('lc', 'loop-controller'), n('a', 'llm-call'), n('b', 'transform'), n('br', 'break'), n('out', 'output')],
      [
        e('1', 'input', 'lc', 'value', 'default-x'),
        e('2', 'lc', 'a', 'output-x', 'userMessage'),
        e('3', 'a', 'b', 'text', 'value'),
        e('4', 'b', 'lc', 'result', 'input-x'),
        e('5', 'b', 'br', 'result', 'value'),
        e('6', 'br', 'out', 'value', 'value'),
      ],
    );
    const body = computeLoopBody(graph, 'lc');
    expect(body.bodyNodeIds.sort()).toEqual(['a', 'b']);
    expect(body.breakNodeIds).toEqual(['br']);
  });

  it('returns empty body when LC has no back-edges', () => {
    const graph = g([n('lc', 'loop-controller')], []);
    const body = computeLoopBody(graph, 'lc');
    expect(body.bodyNodeIds).toEqual([]);
    expect(body.breakNodeIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npm run test:run -- tests/engine/loop-driver.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the body-detection helper**

Create `src/engine/loop-driver.ts`:

```ts
import type { Graph } from '@/domain/graph';
import type { Run, NodeResult, IterationRecord } from '@/domain/run';
import { findBackEdges } from './loop-validation';
import { topologicalOrder } from './scheduler';
import { getNodeDefinition } from '@/nodes/registry';
import type { LoopControllerConfig } from '@/domain/node-types';

export interface LoopBody {
  /** Node ids that re-run on every iteration. */
  bodyNodeIds: string[];
  /** Break nodes attached to this controller — fire once after termination. */
  breakNodeIds: string[];
  /** Edges internal to the body (excluding the back-edges). */
  internalEdges: Graph['edges'];
  /** The back-edges from body → loop-controller. */
  backEdges: Graph['edges'];
}

/**
 * Resolves which body nodes belong to the given Loop Controller.
 * Body = nodes downstream of the LC's outputs that lie on a path back to the LC
 * via a back-edge. Break nodes are listed separately because they fire only once.
 */
export function computeLoopBody(graph: Graph, controllerId: string): LoopBody {
  const back = findBackEdges(graph).filter((e) => e.target === controllerId);
  const fwd = new Map<string, Graph['edges']>();
  for (const node of graph.nodes) fwd.set(node.id, []);
  for (const edge of graph.edges) fwd.get(edge.source)?.push(edge);

  // Forward reachable from LC, *not including* edges back into LC itself.
  const reachable = new Set<string>();
  const stack: string[] = [controllerId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const edge of fwd.get(id) ?? []) {
      if (edge.target === controllerId) continue;
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        stack.push(edge.target);
      }
    }
  }

  // Body = reachable nodes that can reach back to LC via a back-edge.
  const sourcesOfBack = new Set(back.map((e) => e.source));
  const reverse = new Map<string, string[]>();
  for (const node of graph.nodes) reverse.set(node.id, []);
  for (const edge of graph.edges) reverse.get(edge.target)?.push(edge.source);

  const reachesBack = new Set<string>();
  const seedStack = [...sourcesOfBack];
  for (const s of seedStack) reachesBack.add(s);
  while (seedStack.length) {
    const id = seedStack.pop()!;
    for (const upstream of reverse.get(id) ?? []) {
      if (!reachesBack.has(upstream)) {
        reachesBack.add(upstream);
        seedStack.push(upstream);
      }
    }
  }

  const bodyNodeIds: string[] = [];
  const breakNodeIds: string[] = [];
  for (const id of reachable) {
    const node = graph.nodes.find((x) => x.id === id);
    if (!node) continue;
    if (node.type === 'break') {
      breakNodeIds.push(id);
      continue;
    }
    if (reachesBack.has(id)) bodyNodeIds.push(id);
  }

  const bodySet = new Set(bodyNodeIds);
  const internalEdges = graph.edges.filter(
    (e) =>
      (bodySet.has(e.source) || e.source === controllerId) &&
      (bodySet.has(e.target) || e.target === controllerId) &&
      !back.some((b) => b.id === e.id),
  );

  return { bodyNodeIds, breakNodeIds, internalEdges, backEdges: back };
}

/**
 * Runs the loop body for one Loop Controller until termination.
 * Mutates the run's NodeResults in place — body nodes get an IterationRecord
 * appended each iteration, the controller's `details.iterationCount` is updated,
 * and break nodes' outputs are written when the loop exits.
 *
 * Returns a record of break-node-id → final value, so the surrounding runner
 * can propagate those values to the rest of the graph.
 */
export interface LoopDriverResult {
  breakOutputs: Record<string, Record<string, unknown>>;
  bodyOutputs: Record<string, Record<string, unknown>>;
  controllerOutputs: Record<string, unknown>;
  iterationCount: number;
  stopReason: 'continue-false' | 'max-iterations' | 'aborted' | 'error';
}

export interface LoopDriverArgs {
  graph: Graph;
  run: Run;
  controllerId: string;
  /** Outputs of all upstream nodes already executed in the surrounding pass. */
  outputsByNode: Map<string, Record<string, unknown>>;
  apiKey: string;
  signal: AbortSignal;
  setLivePreview?: (nodeId: string, preview: string) => void;
  clearLivePreview?: (nodeId: string) => void;
}

export async function driveLoop(args: LoopDriverArgs): Promise<LoopDriverResult> {
  const { graph, run, controllerId, outputsByNode, apiKey, signal } = args;
  const controllerNode = graph.nodes.find((n) => n.id === controllerId)!;
  const cfg = controllerNode.config as LoopControllerConfig;
  const body = computeLoopBody(graph, controllerId);

  // Build inputs for the controller from the upstream graph (default-* and any non-back edges).
  const allEdgesIntoController = graph.edges.filter(
    (e) => e.target === controllerId && !body.backEdges.some((b) => b.id === e.id),
  );
  const initialInputs: Record<string, unknown> = {};
  for (const edge of allEdgesIntoController) {
    const upstream = outputsByNode.get(edge.source) ?? {};
    initialInputs[edge.targetHandle] = upstream[edge.sourceHandle];
  }

  let iteration = 1;
  let stopReason: LoopDriverResult['stopReason'] = 'continue-false';
  let bodyOutputsByNode = new Map<string, Record<string, unknown>>();
  let controllerOutputs: Record<string, unknown> = {};
  let cycledChannelValues: Record<string, unknown> = {};
  let lastContinue: unknown = false;

  // Topological order *within* the body (using internalEdges only).
  const bodyOrder = topologicalOrder({
    ...graph,
    nodes: graph.nodes.filter((n) => body.bodyNodeIds.includes(n.id) || n.id === controllerId),
    edges: body.internalEdges,
  });

  // Pre-init iterations arrays on body nodes and the controller.
  for (const id of [...body.bodyNodeIds, controllerId]) {
    if (!run.nodeResults[id].iterations) run.nodeResults[id].iterations = [];
  }

  while (true) {
    if (signal.aborted) { stopReason = 'aborted'; break; }
    if (iteration > cfg.maxIterations) { stopReason = 'max-iterations'; break; }

    // 1) Run the controller for this iteration.
    const ctrlResult = run.nodeResults[controllerId];
    ctrlResult.status = 'running';
    const ctrlInputs: Record<string, unknown> = { ...initialInputs, iteration };
    for (const [k, v] of Object.entries(cycledChannelValues)) ctrlInputs[k] = v;
    const ctrlDef = getNodeDefinition('loop-controller')!;
    const ctrlIterDetails: Record<string, unknown> = {};
    let ctrlOut: Record<string, unknown>;
    try {
      ctrlOut = await ctrlDef.run(controllerNode, ctrlInputs, {
        signal, details: ctrlIterDetails, apiKey,
      });
    } catch (e) {
      ctrlResult.status = 'error';
      ctrlResult.errorMessage = (e as Error).message;
      stopReason = 'error';
      throw e;
    }
    ctrlResult.iterations!.push({
      iteration, startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      inputs: JSON.parse(JSON.stringify(ctrlInputs)),
      output: JSON.parse(JSON.stringify(ctrlOut)),
      details: ctrlIterDetails,
    });
    controllerOutputs = ctrlOut;
    outputsByNode.set(controllerId, ctrlOut);

    // 2) Run each body node in topological order. Use the latest controllerOutputs
    //    for inputs that originate at the controller; outputs from earlier-in-order
    //    body nodes for everything else.
    bodyOutputsByNode = new Map();
    for (const id of bodyOrder) {
      if (id === controllerId) continue;
      if (!body.bodyNodeIds.includes(id)) continue;
      if (signal.aborted) { stopReason = 'aborted'; break; }

      const node = graph.nodes.find((n) => n.id === id)!;
      const def = getNodeDefinition(node.type)!;
      const incoming = body.internalEdges.filter((e) => e.target === id);
      const inputs: Record<string, unknown> = {};
      for (const edge of incoming) {
        const src = edge.source === controllerId
          ? controllerOutputs
          : (bodyOutputsByNode.get(edge.source) ?? outputsByNode.get(edge.source) ?? {});
        // Fan-in (multiple edges to same handle) — promote to array on the second hit.
        if (edge.targetHandle in inputs) {
          const existing = inputs[edge.targetHandle];
          inputs[edge.targetHandle] = Array.isArray(existing)
            ? [...existing, src[edge.sourceHandle]]
            : [existing, src[edge.sourceHandle]];
        } else {
          inputs[edge.targetHandle] = src[edge.sourceHandle];
        }
      }

      const result = run.nodeResults[id];
      result.status = 'running';
      const iterStart = new Date().toISOString();
      const iterDetails: Record<string, unknown> = {};
      try {
        const out = await def.run(node, inputs, {
          signal, details: iterDetails, apiKey,
          onStreamUpdate: (preview) => args.setLivePreview?.(id, preview),
        });
        bodyOutputsByNode.set(id, out);
        result.output = out;
        result.input = inputs;
        result.status = 'done';
        args.clearLivePreview?.(id);
        result.iterations!.push({
          iteration, startedAt: iterStart, endedAt: new Date().toISOString(),
          inputs: JSON.parse(JSON.stringify(inputs)),
          output: JSON.parse(JSON.stringify(out)),
          details: iterDetails,
        });
      } catch (e) {
        result.status = 'error';
        result.errorMessage = (e as Error).message;
        result.errorStack = (e as Error).stack;
        args.clearLivePreview?.(id);
        stopReason = 'error';
        throw e;
      }
    }

    // 3) Read back-edges to determine `continue` and the next iteration's channel values.
    cycledChannelValues = {};
    let sawContinue = false;
    for (const back of body.backEdges) {
      const src = bodyOutputsByNode.get(back.source) ?? outputsByNode.get(back.source) ?? {};
      const value = src[back.sourceHandle];
      if (back.targetHandle === 'continue') {
        lastContinue = value;
        sawContinue = true;
      } else if (back.targetHandle.startsWith('input-')) {
        cycledChannelValues[back.targetHandle] = value;
      }
    }

    // 4) Halt check. Empty arrays count as falsy (alongside null/undefined/false/0/'') so that
    //    wiring `LLMCall.toolCalls → LoopController.continue` is the natural ReAct halt.
    const isTruthy = (v: unknown) =>
      v !== null && v !== undefined && v !== false && v !== 0 && v !== '' &&
      !(Array.isArray(v) && v.length === 0);
    if (!sawContinue || !isTruthy(lastContinue)) { stopReason = 'continue-false'; break; }
    iteration++;
  }

  // Mark controller done and stash stop reason.
  const ctrl = run.nodeResults[controllerId];
  ctrl.status = stopReason === 'error' ? 'error' : 'done';
  ctrl.details.stopReason = stopReason;
  ctrl.details.iterationCount = iteration;

  // 5) Fire break nodes once with the latest body outputs.
  const breakOutputs: Record<string, Record<string, unknown>> = {};
  for (const breakId of body.breakNodeIds) {
    const node = graph.nodes.find((n) => n.id === breakId)!;
    const def = getNodeDefinition('break')!;
    const incoming = graph.edges.filter((e) => e.target === breakId);
    const inputs: Record<string, unknown> = {};
    for (const edge of incoming) {
      const src = bodyOutputsByNode.get(edge.source)
        ?? outputsByNode.get(edge.source)
        ?? (edge.source === controllerId ? controllerOutputs : {});
      inputs[edge.targetHandle] = src[edge.sourceHandle];
    }
    const result = run.nodeResults[breakId];
    result.status = 'running';
    const out = await def.run(node, inputs, { signal, details: {}, apiKey });
    result.input = inputs;
    result.output = out;
    result.status = 'done';
    breakOutputs[breakId] = out;
  }

  return {
    breakOutputs,
    bodyOutputs: Object.fromEntries(bodyOutputsByNode),
    controllerOutputs,
    iterationCount: iteration,
    stopReason,
  };
}
```

- [ ] **Step 4: Run body-detection tests, verify they pass**

Run: `npm run test:run -- tests/engine/loop-driver.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add an end-to-end test for the driver using a real loop**

Append to `tests/engine/loop-driver.spec.ts`:

```ts
import { driveLoop } from '@/engine/loop-driver';
import { setActivePinia, createPinia } from 'pinia';
import type { Run, NodeResult } from '@/domain/run';
import { registerNodeDefinition } from '@/nodes/registry';
import '@/nodes/loop-controller';
import '@/nodes/break';

function emptyResult(id: string): NodeResult {
  return { nodeId: id, status: 'idle', details: {} };
}

describe('driveLoop integration', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('iterates until continue is false, propagating the channel value', async () => {
    // Register a tiny "increment" body node for this test only.
    registerNodeDefinition({
      type: 'transform',
      inputPorts: ['value'],
      outputPorts: ['result', 'continue'],
      async run(_node, inputs) {
        const v = (inputs.value as number) + 1;
        return { result: v, continue: v < 3 };
      },
    });

    const graph = g(
      [
        n('seed', 'input'),
        { id: 'lc', type: 'loop-controller', position: { x: 0, y: 0 },
          config: { maxIterations: 10, valueChannels: [{ name: 'n' }] } },
        n('inc', 'transform'),
      ],
      [
        e('e1', 'seed', 'lc', 'value', 'default-n'),
        e('e2', 'lc', 'inc', 'output-n', 'value'),
        e('e3', 'inc', 'lc', 'result', 'input-n'),
        e('e4', 'inc', 'lc', 'continue', 'continue'),
      ],
    );

    const run: Run = {
      schemaVersion: 1, id: 'r', graphId: 'g',
      graphSnapshot: graph,
      startedAt: '', endedAt: null, status: 'running',
      inputs: {}, errors: [],
      nodeResults: {
        seed: emptyResult('seed'), lc: emptyResult('lc'), inc: emptyResult('inc'),
      },
    };
    const outputsByNode = new Map<string, Record<string, unknown>>([
      ['seed', { value: 0 }],
    ]);

    const out = await driveLoop({
      graph, run, controllerId: 'lc', outputsByNode,
      apiKey: '', signal: new AbortController().signal,
    });

    expect(out.iterationCount).toBe(3); // 0→1, 1→2, 2→3 (3 not <3, continue=false)
    expect(out.stopReason).toBe('continue-false');
    expect(run.nodeResults.inc.iterations?.length).toBe(3);
    expect(run.nodeResults.inc.iterations?.[2].output).toEqual({ result: 3, continue: false });
  });
});
```

Run: `npm run test:run -- tests/engine/loop-driver.spec.ts`
Expected: PASS (3 tests total).

- [ ] **Step 6: Wire the driver into the runner**

Modify `src/engine/runner.ts`. Replace the existing topological loop by handling Loop Controllers specially. Find the `for (const id of order)` block and update it to:

```ts
import { topologicalOrderIgnoringBackEdges } from './scheduler';
import { validateLoopTopology } from './loop-validation';
import { driveLoop, computeLoopBody } from './loop-driver';

// ... near the top of runGraph(), before topo:
validateLoopTopology(args.graph);
const order = topologicalOrderIgnoringBackEdges(args.graph);

// Track break node ids skipped during the main pass — they fire from inside driveLoop.
const breakNodeIds = new Set<string>();
for (const node of args.graph.nodes) {
  if (node.type === 'loop-controller') {
    const body = computeLoopBody(args.graph, node.id);
    for (const b of body.breakNodeIds) breakNodeIds.add(b);
    for (const b of body.bodyNodeIds) breakNodeIds.add(b); // park body nodes in main loop too
  }
}

for (const id of order) {
  if (controller.signal.aborted) { run.status = 'aborted'; break; }
  const node = args.graph.nodes.find((n) => n.id === id)!;
  if (breakNodeIds.has(id)) continue; // fired by driveLoop
  if (node.type === 'loop-controller') {
    const driverOut = await driveLoop({
      graph: args.graph, run, controllerId: id, outputsByNode,
      apiKey: args.apiKey, signal: controller.signal,
      setLivePreview: (nid, p) => runStore.setLivePreview(nid, p),
      clearLivePreview: (nid) => runStore.clearLivePreview(nid),
    });
    // Make break outputs available to downstream nodes in the main pass.
    for (const [bid, out] of Object.entries(driverOut.breakOutputs)) outputsByNode.set(bid, out);
    if (driverOut.stopReason === 'max-iterations') {
      throw new Error(`Loop Controller "${id}" exceeded maxIterations`);
    }
    continue;
  }
  // … existing per-node execution unchanged …
}
```

- [ ] **Step 7: Run full test suite**

Run: `npm run typecheck && npm run test:run`
Expected: PASS, 39 passing (33 prior + 3 new loop-driver tests + 3 spec'd in step 5; adjust count to whatever passes).

- [ ] **Step 8: Commit**

```bash
git add src/engine/loop-driver.ts src/engine/runner.ts tests/engine/loop-driver.spec.ts
git commit -m "feat(engine): loop-driver — body detection + iteration scheduling"
```

---

## Task 7: Loop Controller node card + inspector

**Files:**
- Create: `src/components/nodes/LoopControllerNode.vue`
- Create: `src/components/inspectors/LoopControllerInspector.vue`
- Create: `src/components/inspectors/IterationTree.vue`
- Modify: `src/components/Canvas.vue` (register node component)
- Modify: `src/components/AddNodeMenu.vue` (add menu entry + default config)
- Modify: wherever the inspector switch lives (find with `grep -rn 'tool-runner' src/components | grep Inspector`)

- [ ] **Step 1: Create the IterationTree shared component**

Create `src/components/inspectors/IterationTree.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import type { IterationRecord } from '@/domain/run';

const props = defineProps<{ iterations: IterationRecord[] }>();
const expanded = ref<Set<number>>(new Set());

function toggle(i: number) {
  expanded.value.has(i) ? expanded.value.delete(i) : expanded.value.add(i);
  expanded.value = new Set(expanded.value);
}

const empty = computed(() => props.iterations.length === 0);

function format(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="empty" class="text-xs opacity-50 italic">— no iterations yet —</div>
    <div v-for="r in iterations" :key="r.iteration" class="bg-panel rounded">
      <button
        type="button"
        @click="toggle(r.iteration)"
        class="w-full flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer bg-transparent border-0"
      >
        <span class="font-mono">iter {{ r.iteration }}</span>
        <span class="opacity-60">{{ expanded.has(r.iteration) ? '▼' : '▶' }}</span>
      </button>
      <div v-if="expanded.has(r.iteration)" class="px-2 pb-2 flex flex-col gap-1.5">
        <div>
          <div class="text-[10px] uppercase opacity-50 mb-0.5">inputs</div>
          <pre class="bg-elev px-2 py-1.5 rounded text-[11px] whitespace-pre-wrap m-0 max-h-[160px] overflow-auto">{{ format(r.inputs) }}</pre>
        </div>
        <div>
          <div class="text-[10px] uppercase opacity-50 mb-0.5">output</div>
          <pre class="bg-elev px-2 py-1.5 rounded text-[11px] whitespace-pre-wrap m-0 max-h-[160px] overflow-auto">{{ format(r.output) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create the LoopControllerNode card**

Create `src/components/nodes/LoopControllerNode.vue`:

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';
import type { LoopControllerConfig } from '@/domain/node-types';

const props = defineProps<{ id: string; data: { config: LoopControllerConfig } }>();
const graph = useGraphStore();
const run = useRunStore();

const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const channels = computed(() => props.data.config.valueChannels ?? []);
const iterCount = computed(() => run.current?.nodeResults[props.id]?.iterations?.length ?? 0);

function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div class="node-shell group w-[260px] bg-[#25272d] border border-[#16181c] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base" :data-status="status">
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#7aff8a] flex-shrink-0" title="loop controller" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Loop Controller</div>
        <div class="text-text-dim text-[10px] font-mono truncate">
          {{ iterCount > 0 ? `iter ${iterCount} / ${data.config.maxIterations}` : `max ${data.config.maxIterations}` }}
        </div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>
    <div class="py-1">
      <!-- One row per channel: default-X (left) | output-X (right) -->
      <div v-for="ch in channels" :key="ch.name" class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">default-{{ ch.name }}</span>
        <Handle :id="`default-${ch.name}`" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
        <span class="text-text-dim font-mono text-[10px]">output-{{ ch.name }}</span>
        <Handle :id="`output-${ch.name}`" type="source" :position="Position.Right" :style="{ background: colorForType('json') }" />
      </div>
      <!-- Back-edge inputs: input-X -->
      <div v-for="ch in channels" :key="`back-${ch.name}`" class="relative h-6 flex items-center px-3 text-[11px]">
        <Handle :id="`input-${ch.name}`" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
        <span class="text-text-dim font-mono text-[10px]">input-{{ ch.name }}</span>
      </div>
      <!-- continue input + iteration output -->
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">continue</span>
        <Handle id="continue" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
        <span class="text-text-dim font-mono text-[10px]">iteration</span>
        <Handle id="iteration" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Create the LoopControllerInspector**

Create `src/components/inspectors/LoopControllerInspector.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { LoopControllerConfig } from '@/domain/node-types';
import IterationTree from './IterationTree.vue';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as LoopControllerConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);

function update<K extends keyof LoopControllerConfig>(key: K, value: LoopControllerConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}

function addChannel() {
  const next = [...(cfg.value?.valueChannels ?? []), { name: `channel${(cfg.value?.valueChannels?.length ?? 0) + 1}` }];
  update('valueChannels', next);
}
function renameChannel(i: number, name: string) {
  const next = [...(cfg.value?.valueChannels ?? [])];
  next[i] = { name };
  update('valueChannels', next);
}
function removeChannel(i: number) {
  const next = [...(cfg.value?.valueChannels ?? [])];
  next.splice(i, 1);
  update('valueChannels', next);
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Max iterations
      <input type="number" min="1" :value="cfg.maxIterations"
        @input="(e) => update('maxIterations', parseInt((e.target as HTMLInputElement).value, 10) || 25)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui">
    </label>

    <section>
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1.5 flex items-center justify-between">
        <span>Channels ({{ cfg.valueChannels.length }})</span>
        <button type="button" @click="addChannel" class="text-text-dim hover:text-text-base text-[11px]">+ add</button>
      </div>
      <ul class="flex flex-col gap-1.5">
        <li v-for="(c, i) in cfg.valueChannels" :key="i" class="flex items-center gap-1.5">
          <input :value="c.name" @input="(e) => renameChannel(i, (e.target as HTMLInputElement).value)"
            class="bg-elev text-text-base border border-border-base rounded px-2 py-1 text-xs font-mono flex-1">
          <button type="button" @click="removeChannel(i)" class="text-text-dim hover:text-error text-xs">×</button>
        </li>
      </ul>
    </section>

    <section v-if="result?.details?.stopReason">
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1">Stop reason</div>
      <div class="text-xs font-mono">{{ result.details.stopReason }} ({{ result.iterations?.length ?? 0 }} iter)</div>
    </section>

    <section>
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1">Iterations</div>
      <IterationTree :iterations="result?.iterations ?? []" />
    </section>

    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[
        { id: 'default-<name>', type: 'json', description: 'Initial value for each declared channel.' },
        { id: 'input-<name>', type: 'json', description: 'Back-edge value cycling in from the loop body.' },
        { id: 'continue', type: 'json', description: 'Truthy keeps looping; falsy terminates.' },
      ]"
      :outputs="[
        { id: 'output-<name>', type: 'json', description: 'Current channel value per iteration.' },
        { id: 'iteration', type: 'string', description: 'Current 1-based iteration index.' },
      ]"
    />
  </div>
</template>
```

- [ ] **Step 4: Register the Vue component in Canvas.vue**

Modify `src/components/Canvas.vue`. Add to the imports:

```ts
import LoopControllerNode from './nodes/LoopControllerNode.vue';
```

And to `nodeTypes`:

```ts
const nodeTypes = {
  input: markRaw(InputNode), output: markRaw(OutputNode),
  'llm-call': markRaw(LLMCallNode), tool: markRaw(ToolNode),
  'tool-group': markRaw(ToolGroupNode), 'tool-runner': markRaw(ToolRunnerNode),
  'loop-controller': markRaw(LoopControllerNode),
} as Record<string, ReturnType<typeof markRaw>>;
```

- [ ] **Step 5: Add menu entry in AddNodeMenu.vue**

Modify `src/components/AddNodeMenu.vue`. Append to `ALL_OPTIONS`:

```ts
{ type: 'loop-controller', label: 'Loop Controller', description: 'Cycle anchor for ReAct, retry, refinement loops' },
```

And to `defaultConfig`:

```ts
case 'loop-controller': return {
  maxIterations: 25,
  valueChannels: [{ name: 'value' }],
};
```

- [ ] **Step 6: Wire the inspector**

Find the inspector router (`grep -rn "ToolRunnerInspector" src/components | grep -v "ToolRunnerInspector.vue"`). Add:

```ts
import LoopControllerInspector from './inspectors/LoopControllerInspector.vue';
```

And the routing branch:

```ts
v-else-if="node.type === 'loop-controller'"
<LoopControllerInspector :node-id="node.id" />
```

- [ ] **Step 7: Manual smoke test**

```bash
npm run typecheck && npm run test:run
npm run dev
```

In the running app:
1. Right-click on canvas → Loop Controller → place
2. Click the node → inspector should show Max iterations + Channels editor
3. Add a channel named `n` → card should grow new rows for `default-n` / `input-n` / `output-n`
4. Delete the channel → rows disappear

- [ ] **Step 8: Commit**

```bash
git add src/components/nodes/LoopControllerNode.vue \
  src/components/inspectors/LoopControllerInspector.vue \
  src/components/inspectors/IterationTree.vue \
  src/components/Canvas.vue \
  src/components/AddNodeMenu.vue \
  src/components/inspectors/  # whichever router file changed
git commit -m "feat(ui): Loop Controller node card + inspector + iteration tree"
```

---

## Task 8: Break node card + inspector

**Files:**
- Create: `src/components/nodes/BreakNode.vue`
- Create: `src/components/inspectors/BreakInspector.vue`
- Modify: `src/components/Canvas.vue`, `src/components/AddNodeMenu.vue`, inspector router

- [ ] **Step 1: Create the Break card**

Create `src/components/nodes/BreakNode.vue`:

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
function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div class="node-shell group w-[180px] bg-[#25272d] border border-[#16181c] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base" :data-status="status">
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#ff5577] flex-shrink-0" title="break" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Break</div>
        <div class="text-text-dim text-[10px] font-mono truncate">loop exit</div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>
    <div class="relative h-6 rounded-b-md flex items-center justify-between px-3 text-[11px]">
      <span class="text-text-dim font-mono text-[10px]">value</span>
      <Handle id="value" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
      <span class="text-text-dim font-mono text-[10px]">value</span>
      <Handle id="value" type="source" :position="Position.Right" :style="{ background: colorForType('json') }" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create the Break inspector**

Create `src/components/inspectors/BreakInspector.vue`:

```vue
<script setup lang="ts">
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';
defineProps<{ nodeId: string }>();
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="text-xs opacity-60">
      Break sits at a loop's exit. It does not fire until its parent Loop Controller terminates,
      then forwards the latest <code class="font-mono">value</code> to downstream nodes.
    </div>
    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[{ id: 'value', type: 'json', description: 'Latest body value to forward when the loop exits.' }]"
      :outputs="[{ id: 'value', type: 'json', description: 'Forwarded after loop termination.' }]"
    />
  </div>
</template>
```

- [ ] **Step 3: Register in Canvas + AddNodeMenu + Inspector router**

Modify `src/components/Canvas.vue` — add `BreakNode` import and `'break': markRaw(BreakNode)` to `nodeTypes`.

Modify `src/components/AddNodeMenu.vue`:
```ts
{ type: 'break', label: 'Break', description: 'Exit point for a Loop Controller' },
```
and in `defaultConfig`:
```ts
case 'break': return {};
```

Wire `BreakInspector` in the inspector router (mirroring Task 7 step 6).

- [ ] **Step 4: Manual smoke + commit**

Run: `npm run typecheck && npm run test:run`
Manual: drag a Break onto the canvas, click it, inspector renders.

```bash
git add src/components/nodes/BreakNode.vue src/components/inspectors/BreakInspector.vue \
  src/components/Canvas.vue src/components/AddNodeMenu.vue src/components/inspectors/
git commit -m "feat(ui): Break node card + inspector"
```

---

## Task 9: Allow back-edges in the canvas connection validator

**Files:**
- Modify: `src/components/Canvas.vue` (`isValidConnection`)

The current validator rejects mismatched types but doesn't deal with the fact that back-edges (e.g. body → controller) are now legal. Since the type system already covers compatibility, no logic change is strictly required for connection — but we should re-check that our validator does not falsely reject the loop wiring.

- [ ] **Step 1: Verify connections still work**

Walk through the wires we'll need for the test4 raw-ReAct graph:
- `Input.value` (string) → `LoopController.default-messages` (json) — ✗ would fail (string vs json)

This is a problem. Make `string`-typed sources connectable to `json` targets. The cleanest fix: make `json` accept any type at the target side.

Update `src/components/Canvas.vue` `isValidConnection`:

```ts
function isValidConnection(connection: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }): boolean {
  if (connection.source === connection.target) return false;
  const sourceNode = graph.nodes.find((n) => n.id === connection.source);
  const targetNode = graph.nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;
  const sourceType = getSourcePortType(sourceNode, connection.sourceHandle ?? '');
  const targetType = getTargetPortType(targetNode, connection.targetHandle ?? '');
  if (!sourceType || !targetType) return false;
  // `json` is the universal target type — anything plugs in. (Loop Controller's
  // channel ports are typed json so that arbitrary state shapes can flow through.)
  if (targetType === 'json') return true;
  return sourceType === targetType;
}
```

- [ ] **Step 2: Manual test**

Run `npm run dev`. Wire an Input.value into a Loop Controller's `default-<name>` port. Should connect.

- [ ] **Step 3: Commit**

```bash
git add src/components/Canvas.vue
git commit -m "feat(canvas): json target ports accept any source type"
```

---

## Task 10: Extract internal helpers from LLM Call and Tool Runner

The Agent node will reuse these. Pure refactor — behavior unchanged. Existing tests for the call sites must still pass.

**Files:**
- Create: `src/nodes/_internals/llm-once.ts`
- Create: `src/nodes/_internals/tool-batch.ts`
- Modify: `src/nodes/llm-call.ts`
- Modify: `src/nodes/tool-runner.ts`

- [ ] **Step 1: Create `llm-once.ts`**

Create `src/nodes/_internals/llm-once.ts`:

```ts
import type { ChatMessage, ToolCall } from '@/openrouter/types';
import { streamChatCompletion } from '@/openrouter/client';
import type { ToolDefinitionPayload } from '../tool';

export interface LLMOnceArgs {
  apiKey: string;
  signal: AbortSignal;
  model: string;
  temperature: number;
  maxTokens?: number | null;
  responseFormat?: 'text' | 'json_object' | null;
  messages: ChatMessage[];
  tools: ToolDefinitionPayload[];
  onContentDelta?: (delta: string) => void;
  onUsage?: (u: { input: number; output: number }) => void;
}

export interface LLMOnceResult {
  text: string;
  toolCalls: ToolCall[];
  request: unknown;
  response: { text: string };
  usage: { input: number; output: number };
  timing: { totalMs: number; firstTokenMs: number | null };
}

export async function llmOnce(args: LLMOnceArgs): Promise<LLMOnceResult> {
  const requestTools = args.tools.length > 0
    ? args.tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.inputSchema } }))
    : undefined;
  const request = {
    model: args.model,
    messages: args.messages,
    temperature: args.temperature,
    max_tokens: args.maxTokens ?? undefined,
    response_format: args.responseFormat === 'json_object' ? { type: 'json_object' as const } : undefined,
    tools: requestTools,
    parallel_tool_calls: requestTools ? true : undefined,
  };
  const t0 = performance.now();
  let firstTokenAtMs: number | null = null;
  let assembled = '';
  let usage = { input: 0, output: 0 };
  let captured: ToolCall[] = [];
  await streamChatCompletion({
    apiKey: args.apiKey, request, signal: args.signal,
    onContentDelta: (d) => { if (firstTokenAtMs === null) firstTokenAtMs = performance.now() - t0; assembled += d; args.onContentDelta?.(d); },
    onUsage: (u) => { usage = { input: u.input, output: u.output }; args.onUsage?.(usage); },
    onToolCalls: (calls) => { captured = calls; },
  });
  return {
    text: assembled,
    toolCalls: captured,
    request,
    response: { text: assembled },
    usage,
    timing: { totalMs: performance.now() - t0, firstTokenMs: firstTokenAtMs },
  };
}
```

- [ ] **Step 2: Create `tool-batch.ts`**

Create `src/nodes/_internals/tool-batch.ts`:

```ts
import type { ChatMessage, ToolCall } from '@/openrouter/types';
import type { ToolDefinitionPayload } from '../tool';
import { runInSandbox } from '@/sandbox/runner';
import type { ToolRunResult } from '../tool-runner';

export interface ToolBatchArgs {
  toolCalls: ToolCall[];
  tools: ToolDefinitionPayload[];
  signal: AbortSignal;
}

export interface ToolBatchResult {
  results: ToolRunResult[];
  toolMessages: ChatMessage[];
}

export async function runToolBatch(args: ToolBatchArgs): Promise<ToolBatchResult> {
  const byName = new Map(args.tools.map((t) => [t.name, t]));
  const results: ToolRunResult[] = [];
  await Promise.all(args.toolCalls.map(async (call) => {
    const def = byName.get(call.function.name);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(call.function.arguments || '{}'); } catch { /* leave empty */ }
    if (!def) {
      results.push({ toolCallId: call.id, name: call.function.name, input: parsed, error: 'tool not found', durationMs: 0 });
      return;
    }
    const sb = await runInSandbox({ code: def.code, inputs: parsed, timeoutMs: def.timeoutMs, signal: args.signal });
    if (sb.kind === 'ok') results.push({ toolCallId: call.id, name: call.function.name, input: parsed, output: sb.value, durationMs: sb.durationMs });
    else results.push({ toolCallId: call.id, name: call.function.name, input: parsed, error: sb.message, durationMs: sb.durationMs });
  }));
  const toolMessages: ChatMessage[] = results.map((r) => ({
    role: 'tool', tool_call_id: r.toolCallId, name: r.name,
    content: r.error ? `Error: ${r.error}` : String(r.output ?? ''),
  }));
  return { results, toolMessages };
}
```

- [ ] **Step 3: Refactor `llm-call.ts` to use `llmOnce`**

Replace `src/nodes/llm-call.ts` body to call `llmOnce`:

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { LLMCallConfig } from '@/domain/node-types';
import type { ChatMessage } from '@/openrouter/types';
import type { ToolDefinitionPayload } from './tool';
import { llmOnce } from './_internals/llm-once';
import { useRunStore } from '@/stores/run';

function buildMessages(cfg: LLMCallConfig, inputs: Record<string, unknown>): ChatMessage[] {
  const upstream = inputs.messages;
  if (Array.isArray(upstream)) {
    if (cfg.systemPrompt && (upstream as ChatMessage[])[0]?.role !== 'system') {
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

function flattenTools(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    const out: ToolDefinitionPayload[] = [];
    for (const item of input) Array.isArray(item) ? out.push(...item) : out.push(item as ToolDefinitionPayload);
    return out;
  }
  return [input as ToolDefinitionPayload];
}

export const llmCallNode: NodeDefinition = {
  type: 'llm-call',
  inputPorts: ['messages', 'userMessage', 'tools'],
  outputPorts: ['text', 'toolCalls', 'messages', 'usage'],
  async run(node, inputs, ctx) {
    const cfg = node.config as LLMCallConfig;
    const messages = buildMessages(cfg, inputs);
    const tools = flattenTools(inputs.tools);
    useRunStore().incrementApiCalls();

    const out = await llmOnce({
      apiKey: ctx.apiKey, signal: ctx.signal,
      model: cfg.model, temperature: cfg.temperature, maxTokens: cfg.maxTokens, responseFormat: cfg.responseFormat,
      messages, tools,
      onContentDelta: (d) => {
        const preview = ((ctx.details.responseTextSoFar as string | undefined) ?? '') + d;
        ctx.details.responseTextSoFar = preview;
        ctx.onStreamUpdate?.(preview.length > 80 ? `…${preview.slice(-80)}` : preview);
      },
      onUsage: (u) => useRunStore().addTokens(u.input, u.output),
    });

    ctx.details.request = out.request;
    ctx.details.response = out.response;
    ctx.details.usage = out.usage;
    ctx.details.timing = out.timing;
    ctx.details.toolCalls = out.toolCalls;

    const assistantMessage: ChatMessage = { role: 'assistant', content: out.text };
    if (out.toolCalls.length > 0) assistantMessage.tool_calls = out.toolCalls;
    return {
      text: out.text,
      toolCalls: out.toolCalls,
      messages: [...messages, assistantMessage],
      usage: out.usage,
    };
  },
};

registerNodeDefinition(llmCallNode);
```

- [ ] **Step 4: Refactor `tool-runner.ts` to use `runToolBatch`**

Replace `src/nodes/tool-runner.ts` to call the helper. Keep the `flatten` function inline (the runner wires its own `tools` input from a Tool Group and may receive nested arrays):

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolDefinitionPayload } from './tool';
import type { ChatMessage, ToolCall } from '@/openrouter/types';
import { runToolBatch } from './_internals/tool-batch';

export interface ToolRunResult {
  toolCallId: string; name: string; input: Record<string, unknown>;
  output?: unknown; error?: string; durationMs: number;
}

function flatten(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    const out: ToolDefinitionPayload[] = [];
    for (const item of input) Array.isArray(item) ? out.push(...item) : out.push(item as ToolDefinitionPayload);
    return out;
  }
  return [input as ToolDefinitionPayload];
}

export const toolRunnerNode: NodeDefinition = {
  type: 'tool-runner',
  inputPorts: ['toolCalls', 'tools', 'messages'],
  outputPorts: ['messages', 'results'],
  async run(_node, inputs, ctx) {
    const toolCalls = (inputs.toolCalls as ToolCall[] | undefined) ?? [];
    const tools = flatten(inputs.tools);
    const messagesIn = (inputs.messages as ChatMessage[] | undefined) ?? [];
    const { results, toolMessages } = await runToolBatch({ toolCalls, tools, signal: ctx.signal });
    ctx.details.results = results;
    return { messages: [...messagesIn, ...toolMessages], results };
  },
};

registerNodeDefinition(toolRunnerNode);
```

- [ ] **Step 5: Run typecheck + full test suite**

Run: `npm run typecheck && npm run test:run`
Expected: PASS, all tests still green (refactor preserves behavior).

- [ ] **Step 6: Commit**

```bash
git add src/nodes/_internals/llm-once.ts src/nodes/_internals/tool-batch.ts src/nodes/llm-call.ts src/nodes/tool-runner.ts
git commit -m "refactor(nodes): extract llmOnce + runToolBatch helpers for reuse"
```

---

## Task 11: Agent node — internal loop using extracted helpers

**Files:**
- Create: `src/nodes/agent.ts`
- Create: `tests/nodes/agent.spec.ts`
- Modify: `src/main.ts` (or wherever the import barrel is)

- [ ] **Step 1: Write failing tests**

Create `tests/nodes/agent.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { agentNode } from '@/nodes/agent';
import type { Node } from '@/domain/graph';
import * as llmOnceModule from '@/nodes/_internals/llm-once';

function makeAgent(): Node {
  return {
    id: 'a', type: 'agent', position: { x: 0, y: 0 },
    config: {
      model: 'm', systemPrompt: '', temperature: 0,
      maxTokens: null, maxIterations: 5, stopCondition: 'no-tool-calls',
    },
  };
}
const ctx = () => ({ signal: new AbortController().signal, details: {} as Record<string, unknown>, apiKey: 'k' });

describe('agentNode', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.restoreAllMocks(); });

  it('returns text immediately when LLM emits no tool calls', async () => {
    vi.spyOn(llmOnceModule, 'llmOnce').mockResolvedValue({
      text: 'final', toolCalls: [],
      request: {}, response: { text: 'final' },
      usage: { input: 1, output: 2 }, timing: { totalMs: 1, firstTokenMs: 0 },
    });
    const out = await agentNode.run(makeAgent(), { userMessage: 'hi' }, ctx());
    expect(out.text).toBe('final');
    expect(out.iterationCount).toBe(1);
  });

  it('loops while toolCalls are emitted, stops when they stop', async () => {
    const responses = [
      { text: '', toolCalls: [{ id: 't1', type: 'function' as const, function: { name: 'noop', arguments: '{}' } }],
        request: {}, response: { text: '' }, usage: { input: 1, output: 1 }, timing: { totalMs: 1, firstTokenMs: 0 } },
      { text: 'done', toolCalls: [],
        request: {}, response: { text: 'done' }, usage: { input: 1, output: 1 }, timing: { totalMs: 1, firstTokenMs: 0 } },
    ];
    vi.spyOn(llmOnceModule, 'llmOnce').mockImplementation(async () => responses.shift()!);
    const tools = [{ name: 'noop', description: '', inputSchema: { type: 'object' }, code: 'return null;', timeoutMs: 1000 }];
    const out = await agentNode.run(makeAgent(), { userMessage: 'go', tools }, ctx());
    expect(out.iterationCount).toBe(2);
    expect(out.text).toBe('done');
  });

  it('errors when maxIterations is exceeded', async () => {
    vi.spyOn(llmOnceModule, 'llmOnce').mockResolvedValue({
      text: '', toolCalls: [{ id: 't', type: 'function' as const, function: { name: 'x', arguments: '{}' } }],
      request: {}, response: { text: '' }, usage: { input: 0, output: 0 }, timing: { totalMs: 0, firstTokenMs: 0 },
    });
    const node = makeAgent();
    (node.config as Record<string, unknown>).maxIterations = 2;
    const tools = [{ name: 'x', description: '', inputSchema: { type: 'object' }, code: 'return 1;', timeoutMs: 1000 }];
    await expect(agentNode.run(node, { userMessage: 'go', tools }, ctx())).rejects.toThrow(/maxIterations/);
  });
});
```

- [ ] **Step 2: Run failing**

Run: `npm run test:run -- tests/nodes/agent.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the agent node**

Create `src/nodes/agent.ts`:

```ts
import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { AgentConfig } from '@/domain/node-types';
import type { ChatMessage } from '@/openrouter/types';
import type { ToolDefinitionPayload } from './tool';
import { llmOnce } from './_internals/llm-once';
import { runToolBatch } from './_internals/tool-batch';
import { useRunStore } from '@/stores/run';

interface AgentIteration {
  iteration: number;
  llm: { request: unknown; response: { text: string }; usage: { input: number; output: number }; timing: { totalMs: number; firstTokenMs: number | null } };
  toolCalls: ReturnType<typeof JSON.parse>; // ToolCall[] but we keep it loose for the iteration record
  tools: { name: string; input: Record<string, unknown>; output?: unknown; error?: string; durationMs: number }[];
}

function flattenTools(input: unknown): ToolDefinitionPayload[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    const out: ToolDefinitionPayload[] = [];
    for (const item of input) Array.isArray(item) ? out.push(...item) : out.push(item as ToolDefinitionPayload);
    return out;
  }
  return [input as ToolDefinitionPayload];
}

function buildInitialMessages(cfg: AgentConfig, inputs: Record<string, unknown>): ChatMessage[] {
  const upstream = inputs.messages;
  if (Array.isArray(upstream)) {
    if (cfg.systemPrompt && (upstream as ChatMessage[])[0]?.role !== 'system') {
      return [{ role: 'system', content: cfg.systemPrompt }, ...(upstream as ChatMessage[])];
    }
    return upstream as ChatMessage[];
  }
  const messages: ChatMessage[] = [];
  if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });
  const um = typeof inputs.userMessage === 'string' ? inputs.userMessage : '';
  if (um) messages.push({ role: 'user', content: um });
  return messages;
}

export const agentNode: NodeDefinition = {
  type: 'agent',
  inputPorts: ['messages', 'userMessage', 'tools'],
  outputPorts: ['text', 'messages', 'iterationCount'],
  async run(node, inputs, ctx) {
    const cfg = node.config as AgentConfig;
    const tools = flattenTools(inputs.tools);
    let messages = buildInitialMessages(cfg, inputs);
    const iterations: AgentIteration[] = [];
    let lastText = '';
    const runStore = useRunStore();

    for (let i = 1; i <= cfg.maxIterations; i++) {
      if (ctx.signal.aborted) throw new Error('aborted');
      runStore.incrementApiCalls();

      const llm = await llmOnce({
        apiKey: ctx.apiKey, signal: ctx.signal,
        model: cfg.model, temperature: cfg.temperature, maxTokens: cfg.maxTokens,
        responseFormat: null, messages, tools,
        onUsage: (u) => runStore.addTokens(u.input, u.output),
        onContentDelta: (d) => ctx.onStreamUpdate?.(d),
      });
      lastText = llm.text;
      const assistantMsg: ChatMessage = { role: 'assistant', content: llm.text };
      if (llm.toolCalls.length > 0) assistantMsg.tool_calls = llm.toolCalls;
      messages = [...messages, assistantMsg];

      if (llm.toolCalls.length === 0) {
        iterations.push({
          iteration: i,
          llm: { request: llm.request, response: llm.response, usage: llm.usage, timing: llm.timing },
          toolCalls: [], tools: [],
        });
        ctx.details.iterations = iterations;
        ctx.details.stopReason = 'final-answer';
        return { text: lastText, messages, iterationCount: i };
      }

      const batch = await runToolBatch({ toolCalls: llm.toolCalls, tools, signal: ctx.signal });
      messages = [...messages, ...batch.toolMessages];
      iterations.push({
        iteration: i,
        llm: { request: llm.request, response: llm.response, usage: llm.usage, timing: llm.timing },
        toolCalls: llm.toolCalls,
        tools: batch.results,
      });
      ctx.details.iterations = iterations;
    }

    ctx.details.stopReason = 'max-iterations';
    throw new Error(`Agent: maxIterations (${cfg.maxIterations}) exceeded without a final answer`);
  },
};

registerNodeDefinition(agentNode);
```

- [ ] **Step 4: Register in main.ts barrel**

Add to `src/main.ts` (alongside other node imports):

```ts
import './nodes/agent';
```

- [ ] **Step 5: Run tests**

Run: `npm run test:run -- tests/nodes/agent.spec.ts`
Expected: PASS (3 tests). Full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/nodes/agent.ts tests/nodes/agent.spec.ts src/main.ts
git commit -m "feat(node): agent node — internal loop using shared helpers"
```

---

## Task 12: Agent node card + inspector

**Files:**
- Create: `src/components/nodes/AgentNode.vue`
- Create: `src/components/inspectors/AgentInspector.vue`
- Modify: `src/components/Canvas.vue`, `src/components/AddNodeMenu.vue`, inspector router

- [ ] **Step 1: Create AgentNode.vue (card)**

Create `src/components/nodes/AgentNode.vue`:

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';

const props = defineProps<{ id: string; data: { config: { model: string; maxIterations: number } } }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const iterationsRun = computed(() => {
  const iters = run.current?.nodeResults[props.id]?.details?.iterations as Array<unknown> | undefined;
  return iters?.length ?? 0;
});
function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div class="node-shell group w-[260px] bg-[#25272d] border border-[#16181c] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base" :data-status="status">
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#7aa2ff] flex-shrink-0" title="agent" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Agent</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ data.config.model }}</div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>
    <div class="py-1">
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">userMessage</span>
        <Handle id="userMessage" type="target" :position="Position.Left" :style="{ background: colorForType('string') }" />
        <span class="text-text-dim font-mono text-[10px]">text</span>
        <Handle id="text" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
      </div>
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="target" :position="Position.Left" :style="{ background: colorForType('messages') }" />
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="source" :position="Position.Right" :style="{ background: colorForType('messages') }" />
      </div>
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">tools</span>
        <Handle id="tools" type="target" :position="Position.Left" :style="{ background: colorForType('tools') }" />
        <span class="text-text-dim font-mono text-[10px]">iterationCount</span>
        <Handle id="iterationCount" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
      </div>
    </div>
    <div class="rounded-b-md px-3 py-1.5 text-[10px] opacity-60 border-t border-[#16181c] bg-[#16181c] text-center">
      <span v-if="iterationsRun > 0">{{ iterationsRun }} iter / {{ data.config.maxIterations }}</span>
      <span v-else class="italic">— not yet run —</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create AgentInspector**

Create `src/components/inspectors/AgentInspector.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import { DEFAULT_MODELS } from '@/config/default-models';
import type { AgentConfig } from '@/domain/node-types';
import IterationTree from './IterationTree.vue';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();
const settings = useSettingsStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as AgentConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);
const modelOptions = computed(() => settings.models.length > 0 ? settings.models : DEFAULT_MODELS);

function update<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}

const iterations = computed(() => {
  const arr = result.value?.details?.iterations as Array<{ iteration: number; llm: { usage: { input: number; output: number }; timing: { totalMs: number; firstTokenMs: number | null } }; tools: Array<unknown> }> | undefined;
  if (!arr) return [];
  return arr.map((r) => ({
    iteration: r.iteration,
    startedAt: '', // agent records aggregate per iteration; per-step timestamps live inside r.llm.timing
    inputs: { 'tool-calls': r.tools.length },
    output: { tokens: r.llm.usage.input + r.llm.usage.output, ms: Math.round(r.llm.timing.totalMs) },
  }));
});
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Model
      <select :value="cfg.model" @change="(e) => update('model', (e.target as HTMLSelectElement).value)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui">
        <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.displayName }}</option>
      </select>
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      System prompt
      <textarea :value="cfg.systemPrompt" @input="(e) => update('systemPrompt', (e.target as HTMLTextAreaElement).value)"
        rows="3" class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui resize-y"></textarea>
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Temperature
      <input type="number" min="0" max="2" step="0.1" :value="cfg.temperature"
        @input="(e) => update('temperature', parseFloat((e.target as HTMLInputElement).value))"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui">
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Max iterations
      <input type="number" min="1" :value="cfg.maxIterations"
        @input="(e) => update('maxIterations', parseInt((e.target as HTMLInputElement).value, 10) || 25)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui">
    </label>

    <section v-if="result?.details?.stopReason">
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1">Stop reason</div>
      <div class="text-xs font-mono">{{ result.details.stopReason }}</div>
    </section>

    <section>
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1">Iterations</div>
      <IterationTree :iterations="iterations" />
    </section>

    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[
        { id: 'userMessage', type: 'string', description: 'Initial user prompt for the agent.' },
        { id: 'messages', type: 'messages', description: 'Existing conversation to continue.' },
        { id: 'tools', type: 'tools', description: 'Tools the agent may call. Wire from a Tool Group.' },
      ]"
      :outputs="[
        { id: 'text', type: 'string', description: 'Final assistant text after the loop terminates.' },
        { id: 'messages', type: 'messages', description: 'Full conversation including tool turns.' },
        { id: 'iterationCount', type: 'string', description: 'Number of iterations the agent ran.' },
      ]"
    />
  </div>
</template>
```

- [ ] **Step 3: Register in Canvas + AddNodeMenu + Inspector router**

Modify `src/components/Canvas.vue` — add `AgentNode` import and `'agent': markRaw(AgentNode)` to `nodeTypes`.

Modify `src/components/AddNodeMenu.vue` — append `{ type: 'agent', label: 'Agent', description: 'LLM ↔ Tool loop encapsulated' }` and:

```ts
case 'agent': return {
  model: 'meta-llama/llama-3.3-70b-instruct:free',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: null,
  maxIterations: 25,
  stopCondition: 'no-tool-calls',
};
```

Wire `AgentInspector` in the inspector router.

- [ ] **Step 4: Manual smoke**

Run: `npm run typecheck && npm run test:run && npm run dev`. Drag an Agent onto canvas; confirm config form + ports.

- [ ] **Step 5: Commit**

```bash
git add src/components/nodes/AgentNode.vue src/components/inspectors/AgentInspector.vue \
  src/components/Canvas.vue src/components/AddNodeMenu.vue src/components/inspectors/
git commit -m "feat(ui): Agent node card + inspector"
```

---

## Task 13: LLMCallInspector — iteration selector when inside a loop

When an LLM Call's `result.iterations` is non-empty, the inspector should let the user pick which iteration to view. The default is the latest.

**Files:**
- Modify: `src/components/inspectors/LLMCallInspector.vue`

- [ ] **Step 1: Add iteration selector**

Open `src/components/inspectors/LLMCallInspector.vue`. Add a `selectedIter` ref and an iteration selector at the top of the template; rewrite `messages`, `usage`, `timing`, `responseText`, `requestJson`, `responseJson` to read from the selected iteration record when iterations exist:

```ts
import { ref } from 'vue';
// ...existing imports unchanged

const selectedIter = ref<number | null>(null);

const iterRecords = computed(() => result.value?.iterations ?? []);
const selectedRecord = computed(() => {
  if (iterRecords.value.length === 0) return null;
  const idx = selectedIter.value ?? iterRecords.value.length;
  return iterRecords.value.find((r) => r.iteration === idx) ?? iterRecords.value[iterRecords.value.length - 1];
});

// Replace each existing computed that reads result.value.details.* to first try selectedRecord:
const messages = computed(() => {
  const src = selectedRecord.value?.details ?? result.value?.details;
  const req = (src as { request?: { messages?: Array<{ role: string; content: string }> } } | undefined)?.request;
  return req?.messages ?? [];
});
const usage = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { usage?: { input: number; output: number } } | undefined;
  return src?.usage;
});
const timing = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { timing?: { totalMs: number; firstTokenMs: number | null } } | undefined;
  return src?.timing;
});
const responseText = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { response?: { text?: string } } | undefined;
  return src?.response?.text ?? '';
});
const requestJson = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { request?: unknown } | undefined;
  return src?.request ? JSON.stringify(src.request, null, 2) : '—';
});
const responseJson = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { response?: unknown } | undefined;
  return src?.response ? JSON.stringify(src.response, null, 2) : '—';
});
```

In the template, just under the opening `<div v-if="cfg">`, add:

```vue
<div v-if="iterRecords.length > 1" class="flex items-center gap-2 mb-2 text-xs">
  <span class="opacity-60">iteration</span>
  <select :value="selectedIter ?? iterRecords[iterRecords.length - 1].iteration"
    @change="(e) => selectedIter = parseInt((e.target as HTMLSelectElement).value, 10)"
    class="bg-elev text-text-base border border-border-base rounded px-1 py-0.5">
    <option v-for="r in iterRecords" :key="r.iteration" :value="r.iteration">{{ r.iteration }}</option>
  </select>
</div>
```

- [ ] **Step 2: Manual smoke**

Build a small loop in dev, run it, click the LLM Call node — selector should appear above the sections, switching it should change visible content.

- [ ] **Step 3: Commit**

```bash
git add src/components/inspectors/LLMCallInspector.vue
git commit -m "feat(inspector): iteration selector on LLM Call when inside a loop"
```

---

## Task 14: Example graphs (test3, test4, test5)

**Files:**
- Create: `graphs/test3-self-critique.graph.json`
- Create: `graphs/test4-react-agent.graph.json`
- Create: `graphs/test5-agent-node.graph.json`

These are the spec's templates 5 and 6 plus a self-critique demo. Their primary value is being runnable end-to-end smoke tests; commit them so the user can open and run any of them.

- [ ] **Step 1: test3 — self-critique loop**

Create `graphs/test3-self-critique.graph.json`. This loop drafts → critiques → revises until the critique returns `{ good: true }` or maxIterations hits. Three nodes inside the loop body: LLM critic → Transform (parse JSON) → LLM reviser. The Transform's outputs feed both `input-draft` (the new draft) and `continue` (negation of `good`).

```json
{
  "schemaVersion": 1,
  "id": "11111111-aaaa-4111-aaaa-111111111111",
  "name": "test3-self-critique",
  "createdAt": "2026-05-02T14:00:00.000Z",
  "updatedAt": "2026-05-02T14:00:00.000Z",
  "containsCustomCode": false,
  "nodes": [
    { "id": "in", "type": "input", "position": { "x": 40, "y": 40 },
      "config": { "name": "topic", "defaultValue": "Write a one-sentence definition of \"closure\" in JavaScript." } },
    { "id": "draft", "type": "llm-call", "position": { "x": 320, "y": 40 },
      "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "Write a single sentence answering the user.", "temperature": 0.6, "maxTokens": null, "responseFormat": null } },
    { "id": "lc", "type": "loop-controller", "position": { "x": 640, "y": 60 },
      "config": { "maxIterations": 5, "valueChannels": [{ "name": "draft" }] } },
    { "id": "critic", "type": "llm-call", "position": { "x": 960, "y": 40 },
      "config": { "model": "meta-llama/llama-3.3-70b-instruct:free", "systemPrompt": "Critique the user-provided sentence. Respond ONLY with JSON: {\"good\": boolean, \"critique\": string}. `good` is true only if the sentence is technically accurate AND under 25 words.", "temperature": 0, "maxTokens": null, "responseFormat": "json_object" } },
    { "id": "br", "type": "break", "position": { "x": 1280, "y": 60 }, "config": {} },
    { "id": "out", "type": "output", "position": { "x": 1480, "y": 60 }, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e1", "source": "in", "sourceHandle": "value", "target": "draft", "targetHandle": "userMessage" },
    { "id": "e2", "source": "draft", "sourceHandle": "text", "target": "lc", "targetHandle": "default-draft" },
    { "id": "e3", "source": "lc", "sourceHandle": "output-draft", "target": "critic", "targetHandle": "userMessage" },
    { "id": "e4", "source": "critic", "sourceHandle": "text", "target": "lc", "targetHandle": "input-draft" },
    { "id": "e5", "source": "critic", "sourceHandle": "text", "target": "lc", "targetHandle": "continue" },
    { "id": "e6", "source": "lc", "sourceHandle": "output-draft", "target": "br", "targetHandle": "value" },
    { "id": "e7", "source": "br", "sourceHandle": "value", "target": "out", "targetHandle": "value" }
  ]
}
```

(The `continue` evaluation is purposely permissive: any non-empty critic response is truthy in JS, so the loop will always run to maxIterations once. That is a known imperfection — using a Transform node to parse JSON and emit `!good` is the proper version, but it requires a Transform node implementation, which isn't in this plan. Treat test3 as a smoke test for cycle execution, not as a polished example. The user can fix it once the Transform node lands.)

- [ ] **Step 2: test4 — raw ReAct (LC + LLM + ToolRunner + Break)**

Use the same two math tools from test2. Wire as in spec §13 Template 5. Save to `graphs/test4-react-agent.graph.json`. Below is a complete template:

```json
{
  "schemaVersion": 1,
  "id": "22222222-aaaa-4222-aaaa-222222222222",
  "name": "test4-react-agent",
  "createdAt": "2026-05-02T14:00:00.000Z",
  "updatedAt": "2026-05-02T14:00:00.000Z",
  "containsCustomCode": true,
  "nodes": [
    { "id": "in", "type": "input", "position": { "x": 40, "y": 40 },
      "config": { "name": "userMessage", "defaultValue": "Compute 12 + 7 and 4 × 5 using the tools." } },
    { "id": "tadd", "type": "tool", "position": { "x": 40, "y": 240 },
      "config": { "name": "add", "description": "Add two numbers.", "inputSchema": { "type": "object", "properties": { "a": { "type": "number" }, "b": { "type": "number" } }, "required": ["a", "b"] }, "code": "return inputs.a + inputs.b;", "timeoutMs": 30000 } },
    { "id": "tmul", "type": "tool", "position": { "x": 40, "y": 400 },
      "config": { "name": "multiply", "description": "Multiply two numbers.", "inputSchema": { "type": "object", "properties": { "a": { "type": "number" }, "b": { "type": "number" } }, "required": ["a", "b"] }, "code": "return inputs.a * inputs.b;", "timeoutMs": 30000 } },
    { "id": "tg", "type": "tool-group", "position": { "x": 320, "y": 320 }, "config": { "label": "math tools" } },
    { "id": "lc", "type": "loop-controller", "position": { "x": 600, "y": 60 },
      "config": { "maxIterations": 6, "valueChannels": [{ "name": "messages" }] } },
    { "id": "llm", "type": "llm-call", "position": { "x": 940, "y": 40 },
      "config": { "model": "openai/gpt-oss-120b:free", "systemPrompt": "You are a calculator that always uses the provided tools.", "temperature": 0, "maxTokens": null, "responseFormat": null } },
    { "id": "tr", "type": "tool-runner", "position": { "x": 1280, "y": 40 }, "config": {} },
    { "id": "br", "type": "break", "position": { "x": 1620, "y": 60 }, "config": {} },
    { "id": "out", "type": "output", "position": { "x": 1820, "y": 60 }, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e01", "source": "in",   "sourceHandle": "value", "target": "lc", "targetHandle": "default-messages" },
    { "id": "e02", "source": "tadd", "sourceHandle": "toolDefinition", "target": "tg", "targetHandle": "tools" },
    { "id": "e03", "source": "tmul", "sourceHandle": "toolDefinition", "target": "tg", "targetHandle": "tools" },
    { "id": "e04", "source": "tg",   "sourceHandle": "toolDefinition", "target": "llm", "targetHandle": "tools" },
    { "id": "e05", "source": "tg",   "sourceHandle": "toolDefinition", "target": "tr",  "targetHandle": "tools" },
    { "id": "e06", "source": "lc",   "sourceHandle": "output-messages", "target": "llm", "targetHandle": "messages" },
    { "id": "e07", "source": "llm",  "sourceHandle": "toolCalls",        "target": "tr",  "targetHandle": "toolCalls" },
    { "id": "e08", "source": "llm",  "sourceHandle": "messages",         "target": "tr",  "targetHandle": "messages" },
    { "id": "e09", "source": "tr",   "sourceHandle": "messages",         "target": "lc",  "targetHandle": "input-messages" },
    { "id": "e10", "source": "llm",  "sourceHandle": "toolCalls",        "target": "lc",  "targetHandle": "continue" },
    { "id": "e11", "source": "lc",   "sourceHandle": "output-messages",  "target": "br",  "targetHandle": "value" },
    { "id": "e12", "source": "br",   "sourceHandle": "value",            "target": "out", "targetHandle": "value" }
  ]
}
```

Note: `continue` is wired from `llm.toolCalls` — Task 6's halt check already treats an empty array as falsy, so `[]` (the LLM emitted no tool calls) terminates the loop and a non-empty array keeps it going. No Transform node needed.

- [ ] **Step 3: test5 — encapsulated agent**

Save to `graphs/test5-agent-node.graph.json`:

```json
{
  "schemaVersion": 1,
  "id": "33333333-aaaa-4333-aaaa-333333333333",
  "name": "test5-agent-node",
  "createdAt": "2026-05-02T14:00:00.000Z",
  "updatedAt": "2026-05-02T14:00:00.000Z",
  "containsCustomCode": true,
  "nodes": [
    { "id": "in", "type": "input", "position": { "x": 40, "y": 40 },
      "config": { "name": "userMessage", "defaultValue": "Compute 12 + 7 and 4 × 5 using the tools." } },
    { "id": "tadd", "type": "tool", "position": { "x": 40, "y": 240 },
      "config": { "name": "add", "description": "Add two numbers.", "inputSchema": { "type": "object", "properties": { "a": { "type": "number" }, "b": { "type": "number" } }, "required": ["a", "b"] }, "code": "return inputs.a + inputs.b;", "timeoutMs": 30000 } },
    { "id": "tmul", "type": "tool", "position": { "x": 40, "y": 400 },
      "config": { "name": "multiply", "description": "Multiply two numbers.", "inputSchema": { "type": "object", "properties": { "a": { "type": "number" }, "b": { "type": "number" } }, "required": ["a", "b"] }, "code": "return inputs.a * inputs.b;", "timeoutMs": 30000 } },
    { "id": "tg", "type": "tool-group", "position": { "x": 320, "y": 320 }, "config": { "label": "math tools" } },
    { "id": "ag", "type": "agent", "position": { "x": 640, "y": 80 },
      "config": { "model": "openai/gpt-oss-120b:free", "systemPrompt": "You are a calculator that always uses the provided tools.", "temperature": 0, "maxTokens": null, "maxIterations": 6, "stopCondition": "no-tool-calls" } },
    { "id": "out", "type": "output", "position": { "x": 980, "y": 80 }, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e1", "source": "in",   "sourceHandle": "value", "target": "ag",  "targetHandle": "userMessage" },
    { "id": "e2", "source": "tadd", "sourceHandle": "toolDefinition", "target": "tg", "targetHandle": "tools" },
    { "id": "e3", "source": "tmul", "sourceHandle": "toolDefinition", "target": "tg", "targetHandle": "tools" },
    { "id": "e4", "source": "tg",   "sourceHandle": "toolDefinition", "target": "ag", "targetHandle": "tools" },
    { "id": "e5", "source": "ag",   "sourceHandle": "text", "target": "out", "targetHandle": "value" }
  ]
}
```

- [ ] **Step 4: Run each example end-to-end manually**

```bash
npm run dev
```

Open the app, load each graph, click Run. Verify:
- test3: runs, hits maxIterations or the critic returns short JSON, output renders.
- test4: runs through ≥1 iteration (LLM + tool runner), Break fires, output renders the final `messages` array.
- test5: agent loops internally, output is the final assistant text.

If a graph errors, fix the wiring and re-save before committing — the smoke test is the validation.

- [ ] **Step 5: Commit**

```bash
git add graphs/test3-self-critique.graph.json graphs/test4-react-agent.graph.json graphs/test5-agent-node.graph.json
git commit -m "feat(examples): self-critique loop, raw ReAct, encapsulated agent graphs"
```

---

## Task 15: Spec milestone note + final review

**Files:**
- Modify: `docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md` (append a Plan 3 implementation note section, mirroring the Plan 1/Plan 2 notes that already exist)
- Modify: `README.md` if it has a milestone section

- [ ] **Step 1: Append Plan 3 implementation note**

Find the "Implementation notes" section in the spec (look for the existing Plan 1 / Plan 2 notes). Append:

```markdown
### Plan 3 implementation notes (2026-05-02)

**Cycle support:** the runner now validates back-edges before each run (`src/engine/loop-validation.ts`); only edges that target a `loop-controller` may be back-edges. The topological order is computed with back-edges removed (`topologicalOrderIgnoringBackEdges` in `src/engine/scheduler.ts`).

**Loop driver:** `src/engine/loop-driver.ts` is the per-controller iteration engine. It computes the body and break-node sets via reachability analysis, runs the body in topological order each iteration, and stores an `IterationRecord` on every body node and the controller. Halt is on falsy `continue` (with empty-array treated as falsy so wiring `toolCalls → continue` works for ReAct), max iterations, or abort.

**Continue truthiness:** an empty array is treated as falsy (alongside `null`, `undefined`, `false`, `0`, `''`) so that `LLMCall.toolCalls → LoopController.continue` is the natural ReAct halt wire.

**Agent encapsulation:** the Agent node (`src/nodes/agent.ts`) reuses the same single-turn LLM call (`src/nodes/_internals/llm-once.ts`) and tool batch (`src/nodes/_internals/tool-batch.ts`) helpers as LLM Call and Tool Runner — there is exactly one implementation of each primitive.

**Inspector iteration UX:** the LLM Call inspector shows an iteration selector when a result has more than one `IterationRecord`. The Loop Controller and Agent inspectors share `IterationTree.vue`.

**Known gaps deferred to Plan 4:** the Transform node (referenced in §6.8) is not implemented yet — examples that need JSON parsing currently rely on the empty-array-falsy continue trick. The Chat Input / Chat Output (§6.12) are also Plan 4.
```

- [ ] **Step 2: Update README milestone**

If `README.md` has a milestone list, add a Plan 3 entry mirroring Plan 1 / Plan 2 entries.

- [ ] **Step 3: Final commit**

```bash
git add docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md README.md
git commit -m "docs(spec): Plan 3 implementation notes (Loops & Agents)"
```

---

## Self-Review Notes

**Spec coverage:**
- §6.9 Loop Controller — Tasks 2, 3, 4, 7
- §6.10 Break — Tasks 5, 8
- §6.11 Agent — Tasks 2, 10, 11, 12
- §7.1 Topology rule — Task 1
- §7.3 Traversal (LC re-fires per iteration) — Task 6
- §7.4 Per-node lifecycle (status resets each iter) — Task 6 (status is set to 'running' at the start of each body node iteration)
- §7.6 Errors (loop body error fails the loop) — Task 6 (error path inside driveLoop sets controller status='error' and rethrows)
- §7.7 Cancel (loops abort) — Task 6 signal checks at top of each iteration and before each body node
- §8.1 LLM Call iteration selector — Task 13
- §8.5 Agent inspector — Task 12
- §8.6 Loop Controller inspector — Task 7

**Type consistency:**
- `IterationRecord` matches the type already exported from `src/domain/run.ts` (no new shape).
- `LoopControllerConfig.valueChannels[]` shape is consistent across the node, port resolver, and inspector.
- `AgentConfig.stopCondition` is a literal-only union (`'no-tool-calls'`) which leaves room to extend in v2 without breaking saved graphs.
- The Agent's iteration record format is *not* the same shape as `IterationRecord` — it's a richer per-step structure. The `IterationTree.vue` consumer projects it down to the `IterationRecord` shape in `AgentInspector.vue` (Task 12 step 2). This is intentional: the wire-format is `IterationRecord`, the agent stores domain-specific detail in `details` for full inspection, and the tree component renders the shared subset.

**Placeholder scan:** no `TBD` / `TODO` left in the plan — every code block is complete. The "intentionally empty" note on `BreakConfig` is documentation, not a placeholder.

**Notable risks:**
1. The `topologicalOrder` helper currently throws on cycles — `topologicalOrderIgnoringBackEdges` is the new path used by the runner. The original is still called by `validateAcyclic`. After Plan 3 the validator should stop calling it. *Plan-level decision:* leave it, since the rest of the codebase doesn't call `validateAcyclic` and removing it cleanly is a separate refactor.
2. Channel ports are typed `json` (universal). This means a `messages`-shaped value going through `output-messages` loses its compile-time `messages` typing and downstream LLM Call's `messages` input has to accept it. The Canvas connection validator (Task 9) makes `json` a universal target; that's the deliberate trade — channels carry arbitrary shapes by design. Inspect the wire color difference (cyan vs purple) at the canvas to keep this visible to the user.
3. The empty-array-as-falsy rule in Task 6's halt check is what makes the natural ReAct wire `LLMCall.toolCalls → LoopController.continue` work without a Transform node. Removing or "simplifying" that check will silently break Task 14's test4 — keep it.
