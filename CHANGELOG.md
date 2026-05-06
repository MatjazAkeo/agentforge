# Changelog

All notable changes to AgentForge are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.5-beta.2] — 2026-05-03

First public **beta**. Two major features land here, plus a lot of UX polish.
Opt in via Settings → General → "Receive beta releases" to keep getting these.

Two earlier tags failed to build: `v0.1.5-beta` died on Vite's default
`worker.format: 'iife'` (no code-splitting, which the SQLite Tool Pack's DB
worker needs for its `?url`-imported sql.js WASM — fix: `worker.format: 'es'`
in `vite.config.ts`). `v0.1.5-beta.1` then died on Windows only — Tauri's MSI
bundler requires the optional pre-release identifier to be numeric-only and
≤ 65535, and `beta.1` has alphabetic characters. The release workflow now
skips MSI on Windows for `-alpha` / `-beta` tags (NSIS `.exe` only); stable
releases keep both bundles. Tags are immutable once pushed, so each fix
required a roll-forward bump.

### Added

- **File Input node + chat-side file attachments.** Drop a `.txt` / `.json` / `.pdf`
  into the Input node's side-car directory or the chat composer. Files are
  copied into `<graph>.assets/` so the graph stays portable. PDF text is
  extracted lazily via `pdfjs-dist`. Chat attachments render as chips below the
  bubble instead of dumping wrapped XML into the message body.
- **SQLite Tool Pack node.** A new generic Tool Pack node with a flavor
  registry; v1 ships SQLite as the only flavor. Authors define N named tools
  in one card (master/detail editor with Monaco JSON + JS), each tool body has
  a `sqlite` helper bound into scope (`sqlite.query(sql, params)`,
  `sqlite.tables()`, `sqlite.columns(table)`). Read + write supported; writes
  persist to the side-car .db on successful run completion via atomic
  tmp-rename. Schema panel introspects `sqlite_master` / `PRAGMA table_info`
  on attach. Per-Tool-Pack persistent DB worker keeps sql.js + the parsed DB
  warm across runs.
- **Resizable + collapsible sidebars.** Drag the inner edge of either sidebar
  to resize; widths persist to localStorage. Chevron buttons collapse each
  side to a thin restore button at the canvas edge.
- **`CODEGEN.md`.** SDK-agnostic graph ↔ code spec for AI coding assistants
  (Claude / Codex / Cursor) — schema, per-node reference, semantic operations
  with TS + Python pseudocode, worked examples, reverse-mapping rules. Now
  includes §2.13 (file-input) and §2.14 (tool-pack).
- **Beta releases opt-in.** New Settings → General → "Receive beta releases".
  When off (default), `-alpha` / `-beta` releases are silently ignored by the
  in-app updater. The release workflow rejects any tag that isn't
  `vX.Y.Z` / `vX.Y.Z-alpha[.N|N]` / `vX.Y.Z-beta[.N|N]`.
- **`openrouter/free`** virtual model in LLM Call / Agent / default-model
  dropdowns (auto-routes to a free OpenRouter model). Doesn't appear in the
  Settings → Models catalog tab.
- **Inspector I/O fields are click-to-copy cards** matching the iteration card
  style — single click copies the full value to the clipboard with a brief
  confirmation flash.

### Changed

- Tool Group inspector's Members list now expands Tool Pack tools (not just
  Tool nodes) so the live preview reflects what the runtime actually sees.
- Loop Controller port dots now sit on the outer node edge — wires connect
  cleanly instead of ending short of the visible dot.
- Chat thread renders user attachments as small chips beneath the bubble; the
  raw `<file>...</file>` block goes only to the LLM, not the UI.
- Default sidebar widths: left 200 px, right 300 px.
- README rewritten with hero screenshot, badges, and the modern macOS
  Gatekeeper unblock flow. Repo now has an MIT LICENSE.

### Fixed

- **Tool result content was `[object Object]` for structured returns.** The
  tool-runner used `String()` to coerce results into chat-message content,
  so any tool returning an object delivered the literal string
  `"[object Object]"` to the LLM — which is why agents would hallucinate
  table names instead of using real ones. Structured outputs are JSON-
  serialized now; strings still pass through verbatim.
- **Vue Flow delete events** weren't propagating back to the Pinia store —
  Backspace-deleted nodes/edges would reappear when adding a new one. Bound
  `@nodes-change` / `@edges-change` to mirror remove changes.
- **sql.js WASM 404 in dev + prod.** The default sql.js loader fetched
  `sql-wasm.wasm` at a path Vite didn't serve. Now imported with `?url` and
  passed through `initSqlJs({ locateFile })`.
- **Tool Pack inspector showed "DB not initialized"** when a graph reload
  disposed the DB worker. ConnectionPanel auto-inits on mount when the
  connection has a configured `db` and the graph is saved; SchemaPanel
  defensively gates on `host.isInitialized()`.
- **Graph IDs.** Loading a graph from a template (which uses ids like
  `tmpl-01-hello-model`) failed UUID validation on save+reload. Schema
  relaxed to any non-empty string; templates regenerate a fresh
  `crypto.randomUUID()` on pick.
- **`extensionOf('.hidden')` returned `'hidden'`** — now matches Node's
  `path.extname` semantics and treats dotfiles as having no extension.
- **pdfjs `TextItem | TextMarkedContent` union** narrowed correctly so
  vue-tsc stops complaining and marked-content items don't emit `undefined`s.
- **Inspector composer collapse button** moved to the canvas-facing edge to
  mirror the left-sidebar pattern.
- **Composer alignment** in the chat panel — `+` button now aligns to the
  bottom of the textarea regardless of how tall it grows; matched heights
  and added focus-outline.
- **Composer chip strip** clears immediately on send, not after the run
  finishes.

### Internal

- Sandbox runner accepts a `helpers` map; user code can `await sqlite.query(...)`
  by way of a postMessage round-trip into the main thread. Two new tests pin
  the protocol shape.
- New `src/sqlite/` module — protocol types, DB worker (lazy sql.js +
  per-message dispatch), DbHost (Promise wrapper with id correlation), and a
  per-node DbHost registry with lifecycle hooks tied into the graph store.
- New `src/flavors/` module — generic flavor registry for Tool Packs; SQLite
  flavor as the first concrete implementation.
- `containsCustomCode` flag now flips for Tool Pack nodes with non-empty tool
  bodies (matches the existing `tool` / `transform-custom` behavior).
- `src/persistence/atomic-write.ts` — `writeFileAtomic(path, bytes)` writes to
  `<path>.tmp` and renames; cleans up on rename failure. Used for safe DB
  persistence; gated by the new `fs:allow-rename` Tauri capability.
- 188 tests passing across 39 files (was 99 at the start of v0.1.4).

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

[Unreleased]: https://github.com/MatjazAkeo/agentforge/compare/v0.1.5-beta.2...HEAD
[0.1.5-beta.2]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.5-beta.2
[0.1.4]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.4
[0.1.3]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.3
[0.1.2]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.2
[0.1.0]: https://github.com/MatjazAkeo/agentforge/releases/tag/v0.1.0
