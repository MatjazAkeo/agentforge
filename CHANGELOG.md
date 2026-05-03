# Changelog

All notable changes to AgentForge are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-03

Initial public release.

### Added

#### Canvas & engine
- Node-based visual editor built on Vue Flow with type-aware ports — mismatched wires are rejected at connect time.
- Topological scheduler with cycle support via the **Loop Controller** node.
- Run abortion + per-node streaming previews.
- Run history: every execution is saved as JSON next to the graph file. Click any past run in the Runs panel to reload its full state into the canvas.

#### Nodes
- **Input** — static text source.
- **Output** — terminal sink.
- **LLM Call** — streams responses from any OpenRouter model. Supports system prompt, temperature, max tokens, response format, tool use.
- **Tool** — declares a tool the LLM can call. Body is JS executed in a sandboxed Web Worker with a configurable timeout.
- **Tool Group** — aggregates multiple Tools into one wire (with duplicate-name validation).
- **Tool Runner** — executes the tool calls an LLM emitted, in parallel, sandboxed.
- **Loop Controller** — declarative cycle anchor with named value channels and an optional halt signal.
- **Agent** — convenience wrapper for the LLM↔Tool Runner loop.
- **Prompt Template** — Mustache-style `{{var}}` interpolation, dynamic input ports.
- **Transform** — pure data shaping. Modes: `json-parse`, `json-stringify`, `json-path`, `regex-extract`, `template`, `custom` (JS function body).
- **Chat Input** / **Chat Output** — turn a graph into a chat-driven app.

#### Templates
Six bundled starter graphs accessible from the toolbar:
1. **Hello Model** — Input → LLM Call → Output.
2. **Two-Model Comparison** — same prompt, two models in parallel.
3. **Self-Critique Loop** — Reviser + Critic with conditional halt via Transform.
4. **RAG-lite** — Tool fetches a URL, Prompt Template stitches the answer prompt, Agent answers.
5. **Raw ReAct (chat)** — full ReAct loop unrolled on the canvas.
6. **Encapsulated Agent (chat)** — the same agent loop, encapsulated in the Agent node.

#### OpenRouter integration
- Streaming SSE client.
- In-app model catalog browser (Settings → Models): search, filter by free / supports-tools, see uptime (last 30m, per provider), modality, context length, pricing, supported parameters.
- Per-model uptime chip on each catalog row.
- API key stored in OS keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux) — never on disk in graph files.

#### UI / UX
- Light / dark / system themes (Settings → General).
- iOS-style toggle checkboxes.
- Onboarding screen on first launch.
- Trust-prompt modal: graphs containing custom JS (Tool or Transform `custom` mode) prompt the user before opening.
- Update banner: when a new release is published, the running app prompts to install.
- Keyboard shortcuts for new / open / save / save-as / run / stop.

#### Distribution
- Multi-OS GitHub Actions release pipeline (macOS universal, Linux amd64, Windows x64).
- In-app auto-updater verified by minisign-style signatures (independent of macOS Gatekeeper / Windows SmartScreen).
- Bundled installers: `.dmg`, `.deb`, `.AppImage`, `-setup.exe`, `.msi`.

[Unreleased]: https://github.com/MatjazAkeo/agentforge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.0
