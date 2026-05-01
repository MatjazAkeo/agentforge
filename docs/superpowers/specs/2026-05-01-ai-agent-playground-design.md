# AI Agent Playground — Design Spec

**Date:** 2026-05-01
**Status:** Draft, pending UI prototype validation
**Author:** matjaz@akeo.com

---

## 1. Goal

Build a **local-first, node-based AI agent playground**: a desktop app where you wire together prompts, tools, LLM calls, and loops on a visual canvas and inspect every step of execution in detail.

The playground exists to serve two related goals:

1. **Inspect a single agent's execution in detail** — run an agent and see every byte of every API call, every tool invocation, every iteration of an agent loop.
2. **Experiment with agent designs** — quickly prototype patterns (single call, prompt chaining, parallel comparison, self-critique, RAG, ReAct, multi-step agents) and observe how each behaves.

The deeper meta-goal is **learning by building**: implementing the playground forces a complete understanding of how agents actually work. Off-the-shelf tools (Rivet, LangFlow, Flowise) are explicitly rejected for this reason — see Section 13.

A secondary goal is **shareability with coworkers**: each user installs the desktop app and exchanges graph files. No live collaboration, no cloud backend.

## 2. Non-Goals

The following are explicitly out of scope for v1, and design decisions should *not* be biased toward enabling them:

- Live multi-user collaboration on the same graph
- Cloud deployment / hosted multi-tenant version
- User accounts, auth, or billing
- Embeddings or vector-search nodes
- A pre-built tool catalog (only a Custom JS tool node ships in v1; catalog tools can be added later as syntactic sugar)
- Auto-update mechanism
- Telemetry / analytics
- Native mobile / tablet support

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      Tauri 2 Desktop App                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            Vue 3 Webview (frontend)                        │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐    │  │
│  │  │ Chat     │  │  Canvas    │  │   Inspector          │    │  │
│  │  │ Sidebar  │  │ (Vue Flow) │  │   Side Panel         │    │  │
│  │  │ (left)   │  │  (center)  │  │   (right)            │    │  │
│  │  └──────────┘  └────────────┘  └──────────────────────┘    │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │  Execution Engine (TypeScript)                     │    │  │
│  │  │   - Topological scheduler (with loop support)      │    │  │
│  │  │   - Per-node state machine                         │    │  │
│  │  │   - Streaming I/O                                  │    │  │
│  │  │   - Loop driver (cycles anchored at Loop Ctrl)     │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  │           │                  │                             │  │
│  │           ▼                  ▼                             │  │
│  │   ┌──────────────┐    ┌──────────────────┐                 │  │
│  │   │ OpenRouter   │    │  Web Workers     │                 │  │
│  │   │ HTTP client  │    │  (tool sandbox)  │                 │  │
│  │   └──────────────┘    └──────────────────┘                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐              │
│         ▼                    ▼                    ▼              │
│  ┌─────────────┐   ┌──────────────────┐   ┌────────────────┐     │
│  │ Tauri FS    │   │ Tauri secrets    │   │ Tauri HTTP     │     │
│  │ (Rust)      │   │ (OS keychain /   │   │ (CORS bypass   │     │
│  │             │   │  stronghold)     │   │  if needed)    │     │
│  └─────────────┘   └──────────────────┘   └────────────────┘     │
│         │                                                        │
│         ▼                                                        │
│   ┌──────────────────┐                                           │
│   │  User filesystem │  *.graph.json, *.runs/*.json              │
│   └──────────────────┘                                           │
└──────────────────────────────────────────────────────────────────┘
```

The webview holds all UI and most logic. Tauri Rust commands are used only where the browser cannot reach: filesystem, OS keychain, and (if needed) HTTP proxying past CORS. Tool code runs in isolated Web Workers within the webview.

The three main UI regions are:
- **Chat Sidebar** (left, collapsible) — conversational interface for graph-driven chat (Section 9)
- **Canvas** (center) — Vue Flow editor where you build the agent
- **Inspector** (right, collapsible) — per-node detail panel updated by the latest run

## 4. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Shell | **Tauri 2** | Cross-platform desktop, small binary, Rust backend, native FS/keychain access |
| Frontend framework | **Vue 3** + Composition API + `<script setup>` | User preference; modern Vue is type-safe and ergonomic |
| Language | **TypeScript** (strict mode) | Type safety across the execution engine and node definitions |
| Build tool | **Vite** | Tauri's default frontend toolchain, fast HMR |
| Canvas | **Vue Flow (`@vue-flow/core`)** | Mature Vue port of React Flow; pan/zoom/connect/custom nodes/minimap |
| State | **Pinia** | Vue's official store; clean composition with TS |
| Code editor | **Monaco** (via `monaco-editor`) | For tool source code and prompt template editing |
| LLM provider | **OpenRouter** (OpenAI-compatible REST) | Free models, single API surface, future-proof for adding paid models |
| Sandbox | **Web Workers** | Browser-native tool isolation, has `fetch`, no DOM, abortable |
| Secrets | **Tauri secrets plugin** (`tauri-plugin-stronghold` preferred; community keyring plugin as fallback) | Stores API key in OS-backed encrypted store (Keychain / Cred Manager / Secret Service) |
| Filesystem | **`tauri-plugin-fs`** + **`tauri-plugin-dialog`** | Open/Save dialogs, scoped FS access |

## 5. Domain Model

### 5.1 Graph

A graph is a serializable definition of nodes and edges, plus configuration metadata.

```ts
interface Graph {
  schemaVersion: 1;
  id: string;             // UUID, stable across saves
  name: string;
  description?: string;
  createdAt: string;      // ISO-8601
  updatedAt: string;
  nodes: Node[];
  edges: Edge[];
  containsCustomCode: boolean;  // true if any Tool node has user JS — drives trust prompt on open
}

interface Node {
  id: string;             // UUID
  type: NodeType;         // discriminated union
  position: { x: number; y: number };
  config: NodeConfig;     // type-specific
}

interface Edge {
  id: string;
  source: string;         // Node id
  sourceHandle: string;   // Output port name
  target: string;
  targetHandle: string;   // Input port name
}

type NodeType =
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
```

### 5.2 Run

A run is the persisted record of one execution of a graph.

```ts
interface Run {
  schemaVersion: 1;
  id: string;             // UUID
  graphId: string;        // Links to the graph that produced it
  graphSnapshot: Graph;   // Full graph at time of run, for replayability after edits
  startedAt: string;
  endedAt: string | null; // null if still running or aborted
  status: 'running' | 'completed' | 'failed' | 'aborted';
  inputs: Record<string, unknown>;       // Values from Input / Chat Input nodes
  nodeResults: Record<string, NodeResult>;  // Keyed by node id
  errors: RunError[];
}

interface NodeResult {
  nodeId: string;
  status: 'idle' | 'running' | 'streaming' | 'done' | 'error';
  startedAt?: string;
  endedAt?: string;
  output?: unknown;
  iterations?: IterationRecord[];  // For Loop Controller and any node that fired multiple times inside a loop
  details: NodeResultDetails;       // Type-specific (see Section 8)
  errorMessage?: string;
  errorStack?: string;
}

interface IterationRecord {
  iteration: number;       // 1-based
  startedAt: string;
  endedAt?: string;
  inputs: Record<string, unknown>;
  output?: unknown;
  details?: NodeResultDetails;
}
```

The graph snapshot inside the Run is critical: graphs evolve, but a run must remain meaningful even after the graph is edited. This makes runs fully replayable and diff-able. The `iterations` array on `NodeResult` is what makes loop bodies fully introspectable — every pass through a node inside a loop is recorded.

## 6. Node Types

### 6.1 Input

Source of values into the graph from the toolbar / sidebar.

- **Config:** name, type (`text` | `number` | `json`), default value
- **Inputs:** none
- **Outputs:** one (`value`)

### 6.2 Output

Terminal sink that displays a final value.

- **Config:** `format` — `auto` | `text` | `json` | `markdown`
- **Inputs:** `value`
- **Outputs:** none

### 6.3 LLM Call

Sends a single chat completion request to OpenRouter.

- **Config:**
  - `model`: model ID (string, picked from Settings-managed list)
  - `systemPrompt`: string (optional, supports `{{var}}` substitutions if wired)
  - `temperature`: number (0–2, default 0.7)
  - `maxTokens`: number | null
  - `responseFormat`: `text` | `json_object` (optional; not all free models support `json_object` — flagged in Settings → Models)
- **Inputs:**
  - `messages` — array of chat messages (wired from upstream); the canonical input
  - `userMessage` — single string convenience (optional; if provided alone, becomes a single-message conversation)
  - `tools` — accepts edges from Tool nodes or Tool Group nodes (the LLM is told these tools exist; it may emit tool-use blocks but **does not run them**)
- **Outputs:**
  - `text` — assistant response content (string)
  - `toolCalls` — array of tool-use requests emitted by the model (empty if none)
  - `messages` — input messages plus the assistant response, ready to feed back into a subsequent LLM Call
  - `usage` — token counts
- **Streaming:** yes, tokens stream into the inspector and onto the node card live
- **Important:** the LLM Call node never executes tools itself. If the model emits tool calls and you want them executed, wire `toolCalls` into a Tool Runner node. This keeps the agent loop **fully visible** on the canvas.

### 6.4 Tool

Defines an executable function the LLM can call.

- **Config:**
  - `name`: snake_case identifier exposed to the LLM
  - `description`: prompt-visible description
  - `inputSchema`: JSON Schema (used both for LLM tool registration and runtime validation)
  - `code`: JavaScript function body — receives `inputs` and `helpers`, returns a value (sync or async)
- **Inputs:** none — Tool nodes are leaf-level definitions, not data consumers
- **Outputs:** `toolDefinition` — connects to the `tools` input port of LLM Call nodes (the model is informed about this tool's existence) and to Tool Runner nodes (which know how to actually execute it)
- **Sandbox:** runs in a dedicated Web Worker. Allowed: `fetch`, standard JS, helpers (e.g. `helpers.tauriCommand('read_file', {...})`). Disallowed: DOM, Pinia store access, top-frame navigation.
- **Trust:** opening a graph where any Tool node has non-empty `code` triggers a "this graph contains custom code — run anyway?" modal

### 6.5 Tool Group

Aggregates multiple Tool definitions into a single composite, so consumers (LLM Call, Tool Runner, Agent) can be wired with one edge instead of N. Pure UX/aggregation node — no execution side effects.

- **Config:**
  - `label`: short string shown on the node card (e.g., "Web tools", "Math tools") — purely cosmetic, doesn't affect runtime
- **Inputs:** `tools[]` — a single multi-edge input port that accepts edges from any number of Tool nodes (or even other Tool Groups, allowing nesting)
- **Outputs:** `toolDefinition` — emits the union of all incoming tool definitions as a flat list
- **Behavior:** fires once all upstream Tool / Tool Group nodes have produced their definitions; emits the concatenated list. Duplicate tool names across the group are detected and reported as a validation error before any LLM Call is made (since the LLM cannot have two tools with the same name).

**Why it exists:** without a Tool Group, an LLM Call with 6 tools attached has 6 incoming `tools` edges — visually noisy. With a Tool Group, the same setup is `6 Tools → 1 Tool Group → 1 LLM Call`, which is far cleaner. The aggregation is *pure* — semantically there is no difference between wiring tools directly vs. through a group, only the canvas readability differs.

### 6.6 Tool Runner

Executes the tool calls emitted by an LLM Call node.

- **Config:** none (behavior is fully driven by inputs)
- **Inputs:**
  - `toolCalls` — wired from an LLM Call's `toolCalls` output
  - `tools` — wired from one or more Tool nodes or a Tool Group (the runner needs to know which tool functions to actually invoke)
  - `messages` — the conversation so far (wired from the upstream LLM Call's `messages` output); the runner appends `tool` role messages with the results
- **Outputs:**
  - `messages` — the conversation extended with `assistant` (tool-call) and `tool` (result) messages, ready to feed back into the next LLM Call
  - `results` — array of `{ toolCallId, name, input, output, error? }` for inspection
- **Behavior:** for each tool call in `toolCalls`, looks up the matching Tool definition by name, validates the input against the schema, executes the tool's code in a Web Worker, captures the result. Tool calls within a single Runner execute in parallel (since the LLM emitted them as a batch).
- **Errors:** if a tool errors, the result for that tool call records the error but the Runner does not fail the whole node — the next LLM iteration can decide what to do (retry, give up, apologize). A separate "fail-fast on tool error" config flag can be added in v2 if desired.

### 6.7 Prompt Template

String template with `{{variable}}` placeholders.

- **Config:** `template` (string, edited in Monaco with placeholder highlighting)
- **Inputs:** dynamic — one per `{{var}}` detected in the template
- **Outputs:** `rendered` (string)

### 6.8 Transform

Pure-data transformation between nodes (parse, extract, reformat).

- **Config:** `mode` — `json-parse`, `json-stringify`, `json-path` (with `path` config), `regex-extract` (with `pattern` and `group`), `template` (small string template)
- **Inputs:** `value`
- **Outputs:** `result`

### 6.9 Loop Controller

The single node that may participate in cycles. Provides the spine for any iterative pattern (ReAct, retry-on-error, multi-step refinement, while-loops).

- **Config:**
  - `maxIterations`: number (default 25, enforced as a safety cap; loop errors out if exceeded)
  - `valueChannels`: array of `{ name: string }` — declares the named state channels that flow through the loop. Each channel produces a `default-<name>` input (initial value, fed from outside the loop), an `input-<name>` (cycles back from the loop body), and an `output-<name>` (read by the loop body).
- **Inputs:**
  - `default-<name>` — initial value for each declared channel (from outside the loop)
  - `input-<name>` — value cycling back for each channel (from inside the loop)
  - `continue` — boolean; if truthy at the end of an iteration, the loop runs again; if falsy, the loop terminates
- **Outputs:**
  - `output-<name>` — the current value of each channel (= `default-<name>` on iteration 1, = `input-<name>` from the previous iteration thereafter)
  - `iteration` — current iteration count (for downstream awareness, if needed)

**Execution semantics:**

1. Iteration 1: `output-<name>` ports emit the `default-<name>` values. Loop body executes downstream.
2. Body produces values, including a `continue` boolean, that wire back into `input-<name>` and `continue`.
3. Loop Controller waits for all back-edges to arrive.
4. If `continue` is truthy and `iteration < maxIterations`: iteration++, the new `input-<name>` values become the next iteration's `output-<name>` values, body re-runs.
5. If `continue` is falsy: loop terminates. Control passes to any **Break** node connected to the Loop Controller; downstream of Break runs as a normal DAG.
6. If `iteration === maxIterations` and `continue` is still truthy: loop errors with a `MaxIterationsExceeded` error.

**Inspector:** every iteration is captured as an `IterationRecord` and shown as a tree in the inspector, with each iteration's full per-node state navigable.

### 6.10 Break

Companion to the Loop Controller. The exit point from a loop.

- **Config:** none
- **Inputs:** `value` (typically wired from the same source(s) that feed `input-<name>` channels — it captures the "final" value when the loop terminates)
- **Outputs:** `value` (passes through; downstream of Break runs after the loop terminates)
- **Behavior:** the Break node acts as a barrier — its downstream nodes do not fire until its parent Loop Controller signals termination. When the loop terminates (`continue` went falsy), the Break node fires with the most recent `value`.

### 6.11 Agent (convenience encapsulation)

Equivalent to a Loop Controller + LLM Call + Tool Runner subgraph wrapped into a single node. Provided as a convenience for graphs where you just want a working agent without wiring the full ReAct loop manually.

Pedagogically less valuable than the raw pattern (the loop is hidden), but useful when:
- You're using one agent as a sub-step inside a larger graph and don't want canvas clutter
- You want to ship a working agent quickly and inspect *its overall behavior* rather than its internal loop mechanics

- **Config:**
  - `model`, `systemPrompt`, `temperature`, `maxTokens` (same as LLM Call)
  - `maxIterations`: number (default 25, mirrors Loop Controller's safety cap)
  - `stopCondition`: `'no-tool-calls'` (only option in v1 — loop ends when the LLM responds without tool calls)
- **Inputs:** `messages` and/or `userMessage`; `tools` (wired from Tool nodes)
- **Outputs:**
  - `text` — final assistant answer
  - `messages` — full conversation history including all tool calls and results, ready to feed back into a chat
  - `iterationCount` — how many iterations were used
- **Inspector:** sub-step tree showing each iteration's LLM call and any tool invocations within it (same UX as the Loop Controller's per-iteration view)
- **Implementation note:** internally, the Agent node runs the same scheduler logic that powers Loop Controller + LLM Call + Tool Runner — it is a packaged version of that subgraph, not a parallel implementation. This keeps semantics consistent and limits the maintenance surface.

### 6.12 Chat Input

Special source node that binds to the Chat Sidebar (Section 9).

- **Config:** none
- **Inputs:** none
- **Outputs:**
  - `userMessage` — the latest user message text (string)
  - `messages` — the full chat history including the latest user message (array of chat messages, ready to feed straight into LLM Call)

A graph can have at most one Chat Input node; if one exists, the Chat Sidebar becomes active.

**UX warning:** if the graph wires only `userMessage` (the latest user message) into downstream nodes and never connects the `messages` output, the LLM will see only one turn at a time and the chat will feel amnesiac across turns. The Chat Input node shows a small inline warning ("Connect `messages` for multi-turn context") whenever this wiring is detected — i.e., when the `messages` port has zero outgoing edges but `userMessage` has at least one, and the graph contains an LLM Call or Agent node.

### 6.13 Chat Output

Special sink node that emits assistant replies into the Chat Sidebar.

- **Config:** `format` — `text` | `markdown` (defaults to `markdown`)
- **Inputs:** `text` (string — the assistant reply to render in the chat)
- **Outputs:** none

A graph can have at most one Chat Output node; the Sidebar uses its value to render each turn's assistant message.

## 7. Execution Model

### 7.1 Topology

The graph is a **DAG with one exception: cycles are allowed only if every back-edge in the cycle terminates at a Loop Controller node**. The validator enforces this before any run starts: it walks the graph, collects all back-edges (edges where `target` precedes `source` in topological order), and rejects the run if any back-edge does not target a Loop Controller.

### 7.2 Run trigger

Runs start via:

- The **Run button** in the toolbar (manual trigger)
- A **Chat Sidebar message submission** when a Chat Input node exists (each turn = one Run)

There is no auto-run on edit. A future "Run on save" toggle is left for v2.

### 7.3 Traversal

A topological sort orders all nodes from sources (Inputs, Chat Input, Tool definitions) downward. A node fires when *all* of its connected inputs are ready (**AND-semantics** — there is no OR-merge in v1). Loop Controllers are special: they fire on iteration 1 with `default-<name>` values and re-fire each iteration with the latest `input-<name>` values once all back-edges arrive.

### 7.4 Per-node lifecycle

```
idle → running → (streaming →) done
                          ↘
                            error
```

Each transition updates the canvas (color-coded ring around the node) and the run JSON in memory. Only `done` and `error` are terminal.

Inside a loop, a body node's lifecycle resets to `running` at the start of each iteration; the visible state on the canvas reflects the *latest* iteration. The full per-iteration history is preserved in the run JSON and in the inspector.

### 7.5 Streaming

LLM Call streams response tokens. Tokens are rendered live onto the node card on the canvas (a small text preview, last ~80 chars) and into the inspector if the node is selected. **Downstream nodes wait for completion** — they receive the full string when streaming finishes, never partial text. Streaming-into-streaming is rejected for v1: complexity is high, value is low.

### 7.6 Errors

If a node errors, the run is marked `failed`, the failed node shows red, and **downstream nodes do not execute**. Inside a loop, an error in the body fails the entire loop (the Loop Controller is marked errored too) — there is no automatic "retry on error" in v1; if you want retry behavior, build it explicitly with a Loop Controller and `continue` logic.

The error message and stack are saved into the run JSON. The user can fix the issue and re-run. Partial results from upstream nodes are preserved.

### 7.7 Cancel

A Stop button in the toolbar aborts in-flight HTTP and worker calls via `AbortController`. The run is marked `aborted` and saved. In-flight nodes transition to `error` with a "user aborted" message. Loops in progress are terminated immediately (no further iterations).

## 8. Inspector

The right side panel shows details for the currently selected node. Empty selection shows a top-level run summary (status, durations, total tokens, error count, iteration counts for any loops).

### 8.1 LLM Call

| Section | Content |
|---|---|
| Request | Full JSON body sent to OpenRouter (raw, copy button) |
| Response | Full JSON body received (raw) |
| Conversation | System prompt + messages rendered as a readable transcript |
| Tokens | Input / output / cached counts |
| Timing | Total latency, time-to-first-token |
| Model | Actual model from response (since OpenRouter may route) |
| Cost | Effective cost (`$0` for free) and theoretical paid-tier cost |
| HTTP | Status code, response headers (rate-limit info, request ID) |
| Stream | Token-by-token playback view, replayable as a timeline |
| Tool calls | Parsed tool-use blocks the model emitted (if any) |
| Errors | Stack and full response body if the call failed |

If the LLM Call is inside a loop, an iteration selector appears at the top of the panel; the rest of the panel reflects the chosen iteration.

### 8.2 Tool Runner

| Section | Content |
|---|---|
| Tool calls in | The `toolCalls` array received from the LLM Call |
| Per-call detail | For each tool call: name, input args, matched Tool definition, output, error if any, execution time |
| Console | Aggregated `helpers.log` output across all calls |
| Resulting messages | The extended `messages` array that flows downstream |

### 8.3 Tool

| Section | Content |
|---|---|
| Definition | Name, description, input schema (read-only summary) |
| Source | The JS code (Monaco viewer) |

The Tool node itself does not execute; per-invocation detail lives on the Tool Runner that called it.

### 8.4 Prompt Template

| Section | Content |
|---|---|
| Template | Source string with placeholders highlighted |
| Bindings | Each `{{var}}` and the value it resolved to |
| Rendered | Final output string |

### 8.5 Agent

| Section | Content |
|---|---|
| Iterations | Tree view: each iteration's LLM call → tool calls → next iteration |
| Stop reason | `final-answer` / `max-iterations` / `error` / `aborted` |
| Iteration count | n / maxIterations |
| Sub-step drilldown | Click any iteration to see its full LLM Call / Tool Runner inspector content |

(Same per-iteration record format as Loop Controller — the implementations share the iteration scheduler.)

### 8.6 Loop Controller

| Section | Content |
|---|---|
| Iterations | Tree view: each iteration as an expandable row with per-node state |
| Stop reason | `continue-false` / `max-iterations` / `error` / `aborted` |
| Iteration count | n / maxIterations |
| Per-channel state | For each `valueChannel`, the value at every iteration (history view) |
| Sub-step drilldown | Click any iteration row to see all body-node states for that iteration |

### 8.7 Tool Group

| Section | Content |
|---|---|
| Members | Flat list of every Tool definition flowing through this group, with their names and descriptions |
| Validation | Any duplicate-name conflicts (red-flagged with which Tool nodes are colliding) |

### 8.8 Input / Output / Transform / Break / Chat Input / Chat Output

Just the value, formatted by type. Transform additionally shows the input value and the operation applied. Chat Input/Output show the relevant message text.

## 9. Chat Sidebar

The left-hand sidebar provides a **graph-driven chat interface**: the open graph is the agent definition, the sidebar is where you talk to it.

### 9.1 Activation

The sidebar is enabled when the open graph contains both a **Chat Input** node and a **Chat Output** node. Otherwise, the sidebar shows a placeholder ("This graph isn't a chat agent — add a Chat Input + Chat Output to enable chat mode").

### 9.2 Behavior

1. The sidebar maintains an in-memory chat history (array of `{ role: 'user' | 'assistant', content: string }`).
2. User types a message and submits.
3. The history (user message appended) is provided as the `messages` output of the Chat Input node, and the new user message is provided as `userMessage`.
4. The graph runs end-to-end. The execution is a normal Run — fully inspectable in the canvas + inspector.
5. The Chat Output node's `text` value is appended to the history as the assistant reply and rendered in the sidebar.
6. Repeat from step 2.

### 9.3 Run history & chat history relationship

Each chat turn is **one Run** (one `*.run.json` file). The run JSON includes the chat history that was active when the user submitted, so any past turn is fully replayable from disk. The sidebar can show a "Reload from run" affordance to restore the chat state from a saved run.

### 9.4 UI

- Resembles a standard chat: bubbles for user (right-aligned) and assistant (left-aligned), markdown rendering for assistant messages
- Shows a small "running…" indicator while the graph executes a turn
- A "Clear chat" button resets the in-memory history (does not delete saved runs)
- Streaming tokens from the Chat Output's upstream LLM Call appear progressively in the assistant bubble

### 9.5 Out of scope (v1)

- Per-conversation persistence as a separate chat-session file (v2 idea)
- Editing past messages and re-running from a checkpoint
- Branching conversations
- Standalone chat (not bound to any graph) — explicitly v2

## 10. Persistence

### 10.1 Filesystem layout

```
~/anywhere-the-user-picks/
├── my-agent.graph.json
└── my-agent.runs/
    ├── 2026-05-01T14-30-12-001.run.json
    ├── 2026-05-01T14-31-45-002.run.json
    └── ...
```

Graphs and runs are siblings in the user's chosen directory. The `.runs/` folder is created lazily on the first run.

### 10.2 Save / Open semantics

- `File → New` — new untitled graph in memory
- `File → Open…` — Tauri file dialog → load graph
- `File → Save` — if untitled, fall through to Save As
- `File → Save As…` — Tauri save dialog → write graph file (and create `.runs/` folder if missing)
- `File → New from Template` — clones a bundled template into memory; user must Save As to a real path before they can run it (because runs need a location)

There is no app-managed library, no recent-files list, and no internal database.

### 10.3 Schema versioning

Every persisted file (graph, run) includes `schemaVersion`. Migrations are added when the schema changes. v1 starts at `schemaVersion: 1`.

## 11. Tool Sandbox

User-defined Tool node JavaScript runs in a Web Worker spawned per-tool-invocation. The worker is given:

- `inputs` (parsed JSON, validated against the tool's input schema before invocation)
- `helpers` — a small set of explicit utilities:
  - `helpers.fetch(url, init)` — proxy to global `fetch` (for explicitness)
  - `helpers.tauriCommand(name, args)` — invokes a whitelisted Tauri command (initial whitelist: `read_file`, `write_file`, `list_dir`)
  - `helpers.log(...args)` — pipes to the inspector's Console section
- An `AbortSignal` for cooperative cancellation

What the worker explicitly does *not* have:
- DOM access
- Pinia / app state access
- Direct access to the OpenRouter API key (tools must not exfiltrate the key)
- Arbitrary Tauri command access (only the whitelist)

A timeout (default 30s, configurable per tool) guards against runaway tool code.

**Performance note:** v1 spawns one Web Worker per tool invocation, terminating it on completion. This is simple and isolation-clean. If a graph calls a tool dozens of times per run and worker startup latency becomes noticeable, a v2 optimization is to pool workers per tool definition. Not addressed in v1.

## 12. Settings

The Settings page is a separate route (`/settings`) with three tabs:

### 12.1 API Key

- Single field for the OpenRouter API key
- Stored via the chosen Tauri secrets plugin (Section 4) — never in graph JSON, run JSON, or any plaintext file the user might share
- "Test connection" button that calls OpenRouter `/key` endpoint
- Initial setup: on first launch with no key configured, the app opens to the Settings → API Key tab automatically

### 12.2 Models

- List of model IDs available in the LLM Call dropdown
- Ships with a curated default list of free models known to support tool use (e.g. `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-chat-v3:free`, `google/gemini-2.0-flash-exp:free`, plus a few others — exact list maintained in `src/config/default-models.ts`)
- Add a model: paste an OpenRouter model ID, optionally fetch from `/models` endpoint to browse
- Remove a model from the dropdown (does not affect existing graphs that reference it — they keep working)
- Each model entry stores: `id`, `displayName`, `supportsTools` (boolean, hint for the UI), `supportsJsonMode` (boolean), `notes` (free text)

### 12.3 General

- Theme (light/dark/system)
- Default workspace folder for Save dialog initial path
- Tool execution timeout default

## 13. Why Build This (Rejected Alternatives)

**Rivet (Ironclad):** mature, plugin-extensible, but does not natively support OpenRouter — the OpenAI Chat Node has no base-URL setting. A custom plugin is feasible (~1 day, 150–300 LOC) but does not change Rivet's inspector, which is the primary interface we care about. Estimated 30–40% chance the plugin path leads to a stuck state where Rivet's tool-call parsing or inspector ceiling forces a rebuild anyway.

**LangFlow / Flowise:** broader provider support but more "build then deploy" oriented; less focused on step-by-step inspection.

**The deciding factor:** the goal is to *learn agents by building*, not to ship a workflow product. Adopting a third-party tool spends learning budget on the tool's plugin API instead of on agent internals. Building from scratch is dramatically more valuable for this goal.

**What we borrow from Rivet:** the **Loop Controller pattern** for visible cycles is taken directly from Rivet's design — it's a clean, well-proven solution to "loops in a node graph" and there's no reason to invent our own. Specifically, our Loop Controller has paired `default-<name>` / `input-<name>` / `output-<name>` ports and a `continue` boolean, mirroring Rivet's mechanism.

## 14. Bundled Templates

Five starter graphs ship with the app, accessible via `File → New from Template`. They double as documentation and dogfood the node set.

1. **Hello Model** — `Input → LLM Call → Output`. Demonstrates the simplest run.
2. **Two-Model Comparison** — same input branched into two LLM Call nodes with different models, both feeding two Output nodes.
3. **Self-Critique Loop** — `Input → LLM (initial draft) → Loop Controller (default-draft) → [LLM critique → Transform parses {good: bool, critique: string} → LLM revise (uses critique to improve draft)] → input-draft, continue = !good → Break → Output`. The loop runs until the critique returns `good: true` or `maxIterations` is hit. Demonstrates the Loop Controller pattern with a non-trivial state channel (`draft`) and a model-determined termination condition.
4. **RAG-lite** — `Input (URL) → Tool (fetch URL) → Prompt Template (combines URL contents + question) → LLM Call → Output`.
5. **Raw ReAct Agent** — full ReAct loop made entirely from primitives, **no encapsulation**. Uses Loop Controller + LLM Call + Tool Runner + Tools + Break, plus Chat Input / Chat Output for the interactive loop:
   - Chat Input feeds initial `messages` and `userMessage` into a Loop Controller's `default-messages` channel
   - The Loop Controller's `output-messages` feeds an LLM Call. A Tool Group labeled "Web tools" aggregates `http_get` and `calculator` Tools and feeds a single edge into both the LLM Call's `tools` input and the Tool Runner's `tools` input
   - LLM Call's `messages` and `toolCalls` feed a Tool Runner
   - Tool Runner's extended `messages` wires back into the Loop Controller's `input-messages`
   - The `continue` channel is computed: truthy if the LLM Call's `toolCalls` is non-empty, falsy otherwise (computed via a small Transform node)
   - Break's `value` (the final `messages`) is wired through a Transform that extracts the last assistant message into Chat Output
6. **Encapsulated Agent (chat)** — the same ReAct behavior as Template 5, but using a single **Agent node** instead of unrolling the loop. `Chat Input → Agent (Tool Group "Web tools" with `http_get` + `calculator` wired into the Agent's `tools` input) → Chat Output`. Side-by-side with Template 5, this template makes the equivalence between the encapsulated and raw forms tangible — open both, run the same chat message, compare what the inspector shows.

Templates are stored as graph JSON files inside the app bundle and copied into memory on selection (the user must Save As to give them a real location before running).

## 15. Security Considerations

| Risk | Mitigation |
|---|---|
| API key leakage | Stored in OS keychain only; never in graph or run files; tool sandbox cannot read it |
| Malicious code in shared graph | Trust prompt on every open of a graph with `containsCustomCode: true`; tools sandboxed in Web Workers |
| Tool exfiltration via `fetch` | Cannot prevent without breaking the use case; users opt into running shared graphs and see the trust prompt |
| Tool runaway | Per-tool timeout (default 30s) and cooperative abort via `AbortSignal` |
| Tauri command escalation | Whitelist of commands exposed to tools; FS commands respect Tauri's scope config |
| OpenRouter rate limit hit | Per-call retry on 429 with backoff; visible rate-limit info in HTTP details inspector |
| Infinite loop | Loop Controller `maxIterations` cap (default 25) hard-fails; Stop button always available |

## 16. Testing Strategy

- **Unit:** the execution engine's traversal (including loop scheduling), each node's `run()` function, prompt template parsing, JSON schema validation, tool sandbox isolation. Vitest.
- **Integration:** running a small graph end-to-end with a stubbed OpenRouter HTTP layer (MSW). Cover streaming, tool calls, looping (Loop Controller iterations), error paths, abort.
- **Manual:** the five bundled templates serve as smoke tests; each must run successfully against a known-working free model before any release.

Tauri shell tests are out of scope — the value is in execution correctness, not the desktop wrapper.

## 17. Build & Distribution

- `npm run tauri dev` — Vite dev server + Tauri dev shell
- `npm run tauri build` — produces signed `.dmg` (mac), `.msi` (windows), `.AppImage` (linux)
- Auto-update is out of scope for v1; releases distributed manually (GitHub Releases or shared folder)

## 18. UI Decisions (validated in prototype phase)

Validated via clickable mockups before implementation. Each row was shown as 2–3 alternatives; the winner is recorded here. Mockup files live in `.superpowers/brainstorm/` (gitignored).

| Decision | Choice |
|---|---|
| **Top-level layout** | Three columns. Left sidebar with tabs (Chat \| Runs). Center: canvas. Right: Inspector. All sidebars collapsible. |
| **Node card style** | Informative: title, model, status ring, response preview (~80 chars, live during streaming), token-count badge, optional HTTP-status badge for errors. Width ~220px. |
| **Loop Controller visualization** | Soft translucent dashed region drawn around the loop body (auto-detected from cycle), back-edges drawn in orange with curved routing, Loop Controller card shows live `iter N / max` badge during runs. |
| **Inspector layout** | Single vertical scroll with collapsible sections (accordion). Default expansion: Conversation + Stats expanded, raw I/O / Stream / HTTP / Errors collapsed. When the selected node is inside a loop, an iteration selector appears at the very top. |
| **Runs tab listing** | Rich-preview rows: status icon + timestamp + duration + token count, plus a one-line input excerpt and one-line output excerpt. Right-click row for Delete / Open file / Compare with current. |
| **Chat sidebar** | Standard chat bubbles. Each assistant bubble has a `↗` icon revealed on hover that loads that turn's run into the canvas + Inspector. The currently-loaded turn shows a colored ring without hover (state, not affordance). |
| **Add-node UX** | All three: a floating `+` button (bottom-left of canvas) opens a palette; right-clicking on empty canvas opens a contextual search-as-you-type menu; `⌘K` opens the same palette as a keyboard-first search. One shared component. |
| **Toolbar** | Native OS menu bar (Mac top of screen, Windows/Linux at top of window) for File / Edit / View / Run / Help. In-window toolbar shows: graph name with modified-dot indicator, **live run stats (total tokens in / out and elapsed time, ticking during a run, frozen on last-run summary when idle)**, Run / Stop, Settings icon. |
| **First-launch onboarding** | Dedicated 3-step welcome screen: (1) what the app is, (2) paste OpenRouter API key with a link to sign up, (3) pick a starter template (or skip to blank graph). After completion, normal app shell takes over. |
| **Empty states** | Minimal — a centered headline plus one primary action per empty surface. (Canvas with no graph: "New from Template" button. Runs tab with no runs: "Click ▶ Run to execute." Chat tab on non-chat graphs: "Add Chat Input + Chat Output to enable chat mode.") |
| **Run comparison / diff view** | Deferred to v2. v1 ships the rows + "Compare with current" right-click action (no-op placeholder until then). |

## 19. Phasing

The implementation plan (next step) will sequence work, but the phases are roughly:

1. **Foundation:** Tauri scaffold, Vue 3 app, Vue Flow canvas with Input + Output nodes, save/load to JSON
2. **LLM Call node:** OpenRouter client, streaming, basic inspector, Settings → API Key
3. **Tool + Tool Group + Tool Runner nodes:** Web Worker sandbox, Monaco source editor, trust prompt, tool execution end-to-end, Tool Group aggregation
4. **Run model:** persistent run files, basic run-history sidebar
5. **Loop Controller + Break:** the cycle scheduler, paired-port handling, `maxIterations` enforcement, per-iteration inspector
6. **Agent node:** the convenience encapsulation — reuses the iteration scheduler from phase 5 internally
7. **Prompt Template, Transform, polish:** complete the foundational node set
8. **Chat Sidebar:** Chat Input / Chat Output nodes, sidebar UI, run-per-turn behavior
9. **Templates:** bundle the six starter graphs
10. **Settings → Models** tab: curated list, add/remove, fetch-from-OpenRouter
11. **Cancel, error states, edge cases**

Sequencing detail belongs in the implementation plan, not here.
