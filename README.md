# Agent Playground

A node-based AI agent playground for building, running, and inspecting AI agents.

## Status

Plan 1 (Foundation) — runnable. You can wire `Input → LLM Call → Output` and stream a response from a free OpenRouter model.

Plan 2 (Tools & Persistent Runs) — runnable. Tool/Tool Group/Tool Runner nodes let an LLM call user-defined JS functions in a sandboxed Web Worker; every run is persisted next to the graph and browsable from the Runs tab.

Plan 3 (Loops & Agents) — runnable. Loop Controller and Break nodes let you build cycles on the canvas (ReAct, retry, self-critique); each iteration is recorded and inspectable. The Agent node packages the LLM↔Tool loop as a single node for the common case.

Subsequent plans add: chat sidebar & templates (Plan 4).

### Plan 3 features

- **Loop Controller** node — declarative cycle anchor. Configurable channels (named state slots that flow through the loop), `maxIterations` safety cap, and a `continue` boolean input that halts the loop when falsy
- **Break** node — exit point that fires once after the loop terminates
- **Agent** node — convenience wrapper for the LLM↔ToolRunner loop; uses the same internal helpers as the raw nodes (no parallel implementation)
- **Per-iteration recording** — every loop body node gets an `IterationRecord` per pass, viewable in a collapsible iteration tree in the inspectors
- **LLM Call iteration selector** — when an LLM Call sits inside a loop, the inspector shows a dropdown to pick which iteration to view
- **Empty-array-as-falsy halt rule** — `LLMCall.toolCalls → LoopController.continue` is the natural ReAct halt wire; an empty array means "no more tool calls", terminating the loop
- **Example graphs** — `test3-self-critique`, `test4-react-agent` (raw ReAct), `test5-agent-node` (encapsulated)

### Plan 2 features

- **Tool / Tool Group / Tool Runner** nodes — define a tool, bundle tools into a group, and run the LLM-requested calls
- **Web Worker sandbox** for user JS code — no DOM, no network, hard timeout
- **Trust prompt** when opening a graph that contains custom code (default: deny)
- **Persistent run history** — every run is saved as `<graph>.runs/<timestamp>.run.json` next to the graph file
- **Runs tab** with rich-preview rows; click any row to load that run's full state back into the canvas
- **Right-click a run** to Reveal in Finder or Delete
- **Monaco editor** in the Tool inspector for code, JSON schema, and description fields

## Setup

Prerequisites:
- Rust toolchain (`rustup`)
- Node.js 20+
- Xcode Command Line Tools (macOS) or platform-equivalent
- An OpenRouter API key (free tier works — sign up at https://openrouter.ai/)

```bash
npm install
npm run tauri dev
```

On first launch, paste your OpenRouter API key into the welcome screen. The key is stored in your OS keychain, not on disk.

## Usage

1. Click the **+** button (or right-click on canvas, or press ⌘K) to open the add-node menu
2. Add an **Input** node, an **LLM Call** node, and an **Output** node
3. Wire them: Input.value → LLM Call.userMessage → Output.value
4. Set the Input's default value to a question (click the Input node, edit in the right Inspector)
5. Click **▶ Run** in the toolbar
6. Watch the LLM Call node stream a response live; click any node to see full request/response/timing details in the Inspector

### Building a tool-using agent

1. Open an existing graph, or save a new one first — runs only persist for graphs that have a path on disk
2. Add an **Input**, an **LLM Call**, a **Tool**, a **Tool Group**, a **Tool Runner**, a second **LLM Call**, and an **Output**
3. Wire:
   - `Input.value → LLMCall1.userMessage`
   - `Tool.toolDefinition → ToolGroup.tools`
   - `ToolGroup.toolDefinition → LLMCall1.tools` and `→ ToolRunner.tools`
   - `LLMCall1.toolCalls → ToolRunner.toolCalls`
   - `LLMCall1.messages → ToolRunner.messages`
   - `ToolRunner.messages → LLMCall2.messages`
   - `LLMCall2.text → Output.value`
4. Click the Tool node and edit it: name (e.g. `add`), description, JSON schema for inputs, and the code body — for example: `return inputs.a + inputs.b;`
5. Click **▶ Run**. The first LLM Call decides to invoke the tool, the Tool Runner executes it in the sandbox, and the second LLM Call uses the result to produce the final answer in Output
6. Open the **Runs** tab in the left panel — your run is there. Click any past row to reload its full state into the canvas

## File menu

- **New** (⌘N) — start a new graph
- **Open…** (⌘O) — open a saved graph file
- **Save** (⌘S) — save current graph
- **Save As…** (⌘⇧S) — save to a new location

Graphs are saved as `*.graph.json` files; they are git-friendly and shareable.

## Tests

```bash
npm run test:run     # one-shot
npm run test         # watch mode
npm run typecheck
```

## Project structure

```
src/
├── domain/         # pure types and zod schemas
├── stores/         # Pinia stores (graph, run, settings, ui)
├── nodes/          # node definitions and registry (input, output, llm-call)
├── components/     # Vue components (Layout, Toolbar, Canvas, Inspector, ...)
├── engine/         # execution engine (scheduler, runner, abort, lifecycle)
├── openrouter/     # OpenRouter HTTP client (streaming SSE)
├── persistence/    # graph file save/load
├── secrets/        # keychain bridge
└── config/         # default models list

src-tauri/          # Rust shell (menu, secrets commands, plugin registration)
docs/
├── plans/          # implementation plans
├── superpowers/specs/   # design specs
└── decisions/      # known gotchas
```

## Documentation

- Design spec: `docs/superpowers/specs/2026-05-01-ai-agent-playground-design.md`
- Implementation plans: `docs/plans/`
