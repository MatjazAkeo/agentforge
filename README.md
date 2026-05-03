# AgentForge

> Visual playground for building, running, and inspecting AI agents.

AgentForge is a local-first desktop app that lets you compose AI agents on a node-based canvas — wire prompts, LLM calls, tools, loops, and chat — and see every byte of every step. Built around learning by building, not shipping a workflow product.

---

## Features

- **Visual canvas** — drag nodes onto a grid, wire them with type-aware ports. Mismatched wires are rejected at connect time.
- **Streaming LLM Call** — connects to OpenRouter; tokens stream live onto the node card and into the inspector.
- **Sandboxed tools** — write JavaScript that the model can call. Each invocation runs in a Web Worker with a configurable timeout.
- **Loop Controller** — declarative cycle anchor. Build ReAct, retry, or self-critique loops on the canvas with full per-iteration inspection.
- **Agent node** — convenience wrapper for the LLM↔tool loop, using the same primitives as the raw nodes.
- **Chat sidebar** — when a graph has a Chat Input + Chat Output, the left sidebar swaps into a real chat thread; each submission triggers a Run.
- **Six bundled templates** — Hello Model, Two-Model Comparison, Self-Critique Loop (with conditional halt), RAG-lite, Raw ReAct Chat, Encapsulated Agent Chat. Accessible from the toolbar.
- **Persistent run history** — every execution saved as JSON next to the graph file. Click any past run to reload its full state into the canvas.
- **Light / dark / system themes** — switchable from Settings → General.
- **Browse OpenRouter models in-app** — search the catalog, filter by free / supports-tools, see uptime and pricing chips, add or remove models from your list with one click.

## Quickstart

Prerequisites:
- [Rust toolchain](https://rustup.rs/)
- Node.js 20 or newer
- Xcode Command Line Tools (macOS) or the platform equivalent
- An OpenRouter API key — sign up at [openrouter.ai](https://openrouter.ai/) (free models work)

```bash
git clone https://github.com/MatjazAkeo/agentforge.git
cd agentforge
npm install
npm run tauri dev
```

On first launch the welcome screen prompts for your OpenRouter key. The key is stored in your OS keychain — never on disk in graph files.

## Usage

1. Click **+** on the canvas (or right-click, or press ⌘K) to open the add-node menu.
2. Wire nodes by dragging from a source port to a target port. Compatible types snap together.
3. Click **▶ Run** in the toolbar.
4. Click any node to inspect its inputs, outputs, request/response, and (inside loops) per-iteration history in the right panel.

The Templates button in the toolbar loads a runnable starter graph — try **Encapsulated Agent (chat)** to see a multi-turn agent that calls tools, end-to-end.

## Building for distribution

```bash
npm run tauri build
```

Produces a platform-native installer in `src-tauri/target/release/bundle/`.

## Tech stack

- **Frontend** — Vue 3 + Composition API, Pinia, [Vue Flow](https://vueflow.dev/), Tailwind CSS v4
- **Editor** — Monaco (tool code, prompt templates, custom Transform JS)
- **Shell** — [Tauri 2](https://tauri.app/) (Rust)
- **Engine** — custom topological scheduler with cycle support via the Loop Controller node
- **Tests** — Vitest + MSW

## Project layout

```
src/
├── domain/         pure types
├── stores/         Pinia stores (graph, run, settings, chat, ui)
├── nodes/          node definitions + registry + port-types
├── engine/         scheduler, runner, loop-driver, abort
├── components/     Layout, Toolbar, Canvas, Inspector, settings tabs, ...
├── openrouter/     streaming SSE client + model catalog fetcher
├── persistence/    graph save/load + run-dir helpers
├── secrets/        keychain bridge
├── templates/      bundled starter graphs
└── config/         default model list

src-tauri/          Rust shell (window menu, keychain commands, plugin registration)
```

## Status

Active development. The full v1 node set is shipped and runnable: Input, Output, LLM Call, Tool, Tool Group, Tool Runner, Loop Controller, Agent, Transform, Prompt Template, Chat Input, Chat Output. Bundled templates, run persistence, theme switching, and the in-app model browser are working.

## Contributing

Issues and PRs welcome. This is primarily a personal learning project, so the scope is intentionally narrow — open an issue first to discuss bigger changes.

## License

MIT
