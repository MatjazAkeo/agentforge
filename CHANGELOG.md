# Changelog

All notable changes to AgentForge are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] — 2026-05-03

### Added

- **OpenRouter balance chip in the toolbar.** Shows USD remaining (`total_credits − total_usage`) fetched from `/api/v1/credits`. Refreshes on app launch, after every Run, and on click. Always visible when an API key is configured — even at $0.00.
- **Per-run cost in the metrics strip.** When a run uses any paid model, a `cost: $X.XXXX` chip joins api calls / in / out / ⏱. Computed locally from the cached catalog's per-token pricing — no extra round-trip per call. Hidden for free-only runs to avoid noise. Adaptive precision: 4 decimals under $1, 2 decimals at or above.

### Changed

- Toolbar buttons standardized to a single 36px height. The Settings gear is now a 1:1 square. Credits chip sits between Stop and Settings.

## [0.1.3] — 2026-05-03

### Fixed

- **Auto-update no longer fails with "Cannot read private member from an object whose class did not declare it."** The Tauri updater's `Update` class uses ES `#privateFields`; storing it in a regular `ref()` caused Vue to wrap it in a reactive Proxy and break private-field identity checks at call time. Updater state now lives in a Pinia store using `shallowRef`, which preserves the prototype.

### Changed

- Update prompt is now a centered modal with a blurred backdrop, replacing the corner toast. Same shell as the Templates picker.
- Added an **Update** button to the toolbar (next to Templates) that pulses softly when an update is available. Dismissing the modal keeps the button so you can come back to it.

## [0.1.2] — 2026-05-03

### Fixed

- **API key now persists across app launches.** v0.1.0 declared the `keyring` crate without enabling any platform backend feature; keyring 3.x ships with no backend by default, so reads and writes silently went to an in-memory mock that died with the process. Enabled `apple-native`, `windows-native`, and `sync-secret-service` features so the macOS Security framework, Windows Credential Manager, and Linux Secret Service are actually used.

### Changed

- Release workflow now auto-publishes tagged releases instead of leaving them as drafts. The release body is auto-extracted from the matching CHANGELOG.md section, with a macOS first-launch note appended.
- README and Getting Started docs updated for the modern macOS Gatekeeper "Open Anyway" flow (right-click → Open is gone on recent macOS).

(v0.1.1 was tagged but never published — superseded by this release.)

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

[Unreleased]: https://github.com/MatjazAkeo/agentforge/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.4
[0.1.3]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.3
[0.1.2]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.2
[0.1.0]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.0
