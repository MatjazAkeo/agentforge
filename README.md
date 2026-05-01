# Agent Playground

A node-based AI agent playground for building, running, and inspecting AI agents.

## Status

Plan 1 (Foundation) — runnable. You can wire `Input → LLM Call → Output` and stream a response from a free OpenRouter model.

Subsequent plans add: tools (Plan 2), loops & agent encapsulation (Plan 3), chat sidebar & templates (Plan 4).

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
