# AgentForge — codegen spec for AI agents and humans

This file is the **canonical, machine-readable specification** for translating between an AgentForge `graph.json` and equivalent application code in TypeScript or Python. It is intended to be fed directly to AI coding assistants (Claude, Codex, Cursor, etc.) so they can generate code from a graph or reconstruct a graph from existing code.

It is also designed to be readable by humans.

## Scope

- **In scope:** the AI workflow logic — message construction, model invocation, tool definitions, tool dispatch, control flow (loops, conditional halts, branching), data transformations, chat history handling.
- **Out of scope:** HTTP servers, persistence, retries, observability, secrets management, deployment, UI. These vary per project and are not derivable from a graph.
- **SDK-agnostic.** The pseudocode below uses placeholders for the actual LLM client (`yourLLMClient.chat(...)`). Substitute `openai`, `anthropic`, `langchain`, raw `fetch`, or any other client of your choice — the logic structure is what's portable.

## How to use this file

**To convert a graph → code:** load `graph.json` and this spec, then walk the graph in topological order. Each node maps to a code construct documented in §4. Apply the worked examples in §6 as templates. The output is logic-only — wrap it in your project's framework as appropriate.

**To convert code → graph:** scan the code for the patterns documented in §7. Each recognized pattern emits one node. Wire the nodes via the data-flow rules in §3.

## 1. Graph schema

```ts
interface Graph {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
  nodes: Node[];
  edges: Edge[];
  containsCustomCode: boolean; // true if any Tool or Transform-custom node has user JS
}

interface Node {
  id: string;
  type: NodeType;             // one of the values in §2
  position: { x: number; y: number };  // canvas-only; ignored at runtime
  config: NodeConfig;         // shape depends on `type` — see §2
}

interface Edge {
  id: string;
  source: string;             // source node id
  sourceHandle: string;       // output port name
  target: string;             // target node id
  targetHandle: string;       // input port name
}
```

Edges are typed at the port level. A connection is valid only when `getSourcePortType(source, sourceHandle)` matches `getTargetPortType(target, targetHandle)`. Wire types: `string`, `number`, `messages`, `tools`, `tool-calls`, `json`.

A graph runs in topological order. The only cycles allowed are those anchored at a `loop-controller` node (§2.7).

## 2. Node reference

For each node: **config shape**, **input ports**, **output ports**, **semantic operation**.

### 2.1 input

```ts
config: { name: string; defaultValue: string }
ports.in:  []
ports.out: [text:string]
```

**Semantic:** emits a constant string. The starting point of a non-chat graph.

### 2.2 output

```ts
config: { format: 'auto' | 'text' | 'json' | 'markdown' }
ports.in:  [text:string]
ports.out: []
```

**Semantic:** terminal sink. Captures a value for inspection. In code, this is the program's return value or print statement.

### 2.3 llm-call

```ts
config: {
  model: string;                                   // e.g. "openai/gpt-oss-120b:free"
  systemPrompt: string;                            // empty string means no system message
  temperature: number;
  maxTokens: number | null;
  responseFormat: 'text' | 'json_object' | null;
}
ports.in:  [messages:messages, text:string, tools:tools]
ports.out: [text:string, messages:messages, toolCalls:tool-calls, usage:json]
```

**Semantic:** a single chat completion call. Streaming is an implementation detail — the contract is "given input messages and tools, return text + any tool calls + updated messages history".

**Input precedence:** if `messages` is wired, it is used as-is (with `systemPrompt` prepended if not already present). Otherwise `text` becomes the user message and `systemPrompt` becomes the system message.

**Output `messages`:** input messages + the assistant's reply (with `tool_calls` attached if any).

### 2.4 tool

```ts
config: {
  name: string;                          // snake_case, exposed to LLM
  description: string;                   // prompt-visible
  inputSchema: Record<string, unknown>;  // JSON Schema for the tool's args
  code: string;                          // synchronous JS function body; receives `inputs`
  timeoutMs: number;                     // sandbox kill switch
}
ports.in:  []
ports.out: [toolDefinition:tools]
```

**Semantic:** declares a tool the LLM can call. Emits a tool-definition object containing the schema, name, description, and code. Does not execute; that's `tool-runner`'s job.

**Sandbox:** at runtime the JS executes in a Web Worker with the timeout. When generating production code, the equivalent is a regular function in the host language with the same input schema and behavior. **Do not preserve the sandbox** — translate the JS body to native code (TypeScript) or Python directly, or expose the function however your project does.

### 2.5 tool-group

```ts
config: { label: string }
ports.in:  [tools:tools]                 // multi-edge fan-in
ports.out: [toolDefinition:tools]
```

**Semantic:** flattens multiple tool definitions into a single list. Validates name uniqueness.

### 2.6 tool-runner

```ts
config: {}                               // none
ports.in:  [toolCalls:tool-calls, tools:tools, messages:messages]
ports.out: [messages:messages, results:json]
```

**Semantic:** for each `toolCall` in the input, look up the matching tool by name and execute it with the call's arguments. Append one tool-role message per call to `messages`. `results` is a structured array of `{ toolCallId, name, input, output, error?, durationMs }`.

In code: a parallel dispatch loop over the LLM's emitted tool calls, with results appended to chat history.

### 2.7 loop-controller

```ts
config: {
  maxIterations: number;
  valueChannels: Array<{ name: string; type?: 'string' | 'messages' | 'tools' | 'tool-calls' | 'json' }>;
}
ports.in:  [continue:any, default-<channel>:<type>, input-<channel>:<type>]
ports.out: [iteration:number, output-<channel>:<type>]
```

The `default-<name>` and `input-<name>` ports are **dynamic**, one pair per declared channel.

**Semantic:** the only way to express a cycle in the graph. Maps directly to a `while` loop in code.

- Iteration 1 emits each channel's `default-<name>` value on `output-<name>`.
- Iteration N>1 emits the value most recently received on `input-<name>` (i.e. fed back from the loop body).
- The loop halts when `continue` is **falsy** (null / false / undefined / "" / 0) **or** `iteration > maxIterations`.

In code: `while (continue && i <= maxIterations) { ...body...; i++; channels = newChannels; }`. The `continue` signal is computed by the body, often via a Transform regex on a Critic LLM's verdict.

### 2.8 agent

```ts
config: {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number | null;
  maxIterations: number;
  stopCondition: 'no-tool-calls';
}
ports.in:  [messages:messages, text:string, tools:tools]
ports.out: [text:string, messages:messages, iteration:number]
```

**Semantic:** convenience wrapper for the LLM↔tool loop. Equivalent to: `loop-controller` carrying `messages`, `llm-call` inside the body, `tool-runner` consuming the LLM's `toolCalls`, halting when the LLM returns no tool calls. Use this when you want the loop without wiring it.

When generating code: emit the same `while` loop you'd emit for a hand-wired ReAct (§6.2).

### 2.9 prompt-template

```ts
config: { template: string }                       // contains {{var}} placeholders
ports.in:  [<var>:any]                             // dynamic — one input per {{var}} reference
ports.out: [text:string]
```

**Semantic:** Mustache-style string interpolation. Maps to a template literal, f-string, or `.format()` call.

### 2.10 transform

```ts
config: {
  mode: 'json-parse' | 'json-stringify' | 'json-path' | 'regex-extract' | 'template' | 'custom';
  path?: string;       // json-path
  pattern?: string;    // regex-extract
  group?: number;      // regex-extract; 0 = whole match
  template?: string;   // template mode
  code?: string;       // custom: synchronous JS function body, `value` in scope
}
ports.in:  [value:any]
ports.out: [result:json]
```

**Semantic:** pure data shaping, no I/O. Each mode maps to a one-liner in the host language:

| mode | TypeScript | Python |
|---|---|---|
| `json-parse` | `JSON.parse(value)` | `json.loads(value)` |
| `json-stringify` | `JSON.stringify(value, null, 2)` | `json.dumps(value, indent=2)` |
| `json-path` | walk `path` against `value` | walk `path` against `value` |
| `regex-extract` | `value.match(re)?.[group]` | `re.search(pattern, str(value)).group(group)` |
| `template` | `template.replace('{{value}}', ...)` | `template.replace('{{value}}', ...)` |
| `custom` | translate the JS body verbatim | port the JS body to Python |

### 2.11 chat-input

```ts
config: {}
ports.in:  []
ports.out: [text:string, messages:messages]
```

**Semantic:** runtime entry point for chat-driven graphs. Emits the user's just-submitted message as `text` and the full thread as `messages`. In code, this maps to the function parameter `(userMessage, history)` of your chat handler.

### 2.12 chat-output

```ts
config: { format: 'text' | 'markdown' }
ports.in:  [text:string]
ports.out: []
```

**Semantic:** the assistant's reply written back to the chat thread. In code, the return value of your chat handler.

### 2.13 file-input

```ts
config: {
  files: Array<{
    filename: string;       // basename in <graph>.assets/, may have -2/-3 suffix on collision
    sizeBytes: number;      // recorded at attach time; 10 MB hard cap
    sourcePath?: string;    // user's original path, display only
  }>;
}
ports.in:  []
ports.out: [text:string]
```

**Semantic:** at run time, reads each file from `<graph>.assets/<filename>` (relative to the saved graph file), text-extracts it (UTF-8 for txt/json, pdfjs for pdf), wraps each as `<file name="…">…</file>`, and concatenates with one blank line between blocks into a single string. Throws if the graph is unsaved (no path) or if a referenced asset is missing on disk. Emits the wrapped concatenation on the `text` output port.

**In code:** read each file from disk (or wherever your project sources content from), run extraction if needed, and join with the same XML wrapper from §4.6.5. The graph's "saved location" maps to whatever path conventions your project uses (next to a config, in an `assets/` dir, etc.). If the LLM only needs raw text and you don't care about per-file boundaries, you can skip the wrapper — but matching it is the lossless translation.

### 2.14 tool-pack

```ts
config: {
  flavor: 'sqlite';                             // future: 'http' | 'graphql' | 'postgres' | …
  connection: { db: string; sourcePath?: string; sizeBytes: number };
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;       // JSON Schema for the LLM
    code: string;                                // JS body, has `inputs` and `sqlite` in scope
    maxRows?: number;                            // per-tool override of the 1000-row cap
  }>;
}
ports.in:  []
ports.out: [tools:tools]
```

**Semantic:** instantiates a backend helper based on `flavor`. For SQLite (the only v1 flavor), opens `<graph>.assets/<connection.db>` via sql.js and emits one tool descriptor per configured tool. Each descriptor's `code` runs in a sandboxed Web Worker per call, with the `sqlite` helper bound into scope. The `sqlite` helper exposes `query(sql, params)` returning `{ rows, truncated, rowsAffected? }`, plus `tables()` and `columns(tableName)` for schema introspection. Named params (`:name`) are canonical (pass `inputs` directly as the params object); positional `?` is accepted as fallback when params is an array. Writes accumulate in memory and persist to the side-car .db file on successful run completion.

**In code:** map this to a class or module that holds a connection and exposes one method per tool. Translate each tool's JS body into the host language; substitute the `sqlite` helper with whichever client your project uses. Pseudocode for a SQLite tool with named params:

```ts
// TS — substitute your client
async function ac_get_user_activity(inputs: { user_id: number; since: string }) {
  return await yourSqliteClient.all(
    `SELECT * FROM activities WHERE user_id = :user_id AND created_at >= :since`,
    inputs,
  );
}
```

```python
# Python — substitute your client
def ac_get_user_activity(inputs: dict) -> list[dict]:
    return your_sqlite_client.fetch_all(
        "SELECT * FROM activities WHERE user_id = :user_id AND created_at >= :since",
        inputs,
    )
```

The agent / LLM-call side is unchanged — same as wiring any `tools` wire (§2.4–§2.6).

## 3. Data flow rules

1. **Edges flow data, not control.** The runtime evaluates each node when all its inputs are ready.
2. **Multi-edge fan-in** is allowed only on ports declared as such (Tool Group's `tools` input). Other ports take a single edge.
3. **Fan-out** (one source → many targets) is unrestricted.
4. **Type compatibility** is checked at edit time (§1). Code generators can assume edges are well-typed.
5. **Cycles** require a `loop-controller`. Any back-edge must terminate at one of its `input-<channel>` ports.

## 4. Semantic operations → pseudocode patterns

Below: what each graph construct looks like in TypeScript and Python, abstracted away from a specific LLM SDK. `yourLLMClient.chat()` is a placeholder for whatever you use — `openai.chat.completions.create()`, `anthropic.messages.create()`, raw `fetch`, etc. The signatures below describe the **logical** call.

### 4.1 LLM call

**TypeScript**

```ts
// AGENTFORGE_LLM_CALL — substitute your client
const { text, toolCalls } = await yourLLMClient.chat({
  model,
  messages,                  // [{ role, content }, ...]
  tools,                     // optional
  temperature,
  maxTokens,                 // null -> let the API decide
  responseFormat,            // null | "text" | "json_object"
});
const assistantMsg = { role: "assistant", content: text };
if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
const updatedMessages = [...messages, assistantMsg];
```

**Python**

```python
# AGENTFORGE_LLM_CALL — substitute your client
result = your_llm_client.chat(
    model=model,
    messages=messages,
    tools=tools,                    # optional
    temperature=temperature,
    max_tokens=max_tokens,          # None -> let the API decide
    response_format=response_format # None | "text" | "json_object"
)
text, tool_calls = result.text, result.tool_calls
assistant_msg = {"role": "assistant", "content": text}
if tool_calls:
    assistant_msg["tool_calls"] = tool_calls
updated_messages = [*messages, assistant_msg]
```

### 4.2 Tool definition

A `tool` node maps to a function in the host language whose signature matches the JSON Schema's properties.

**TypeScript**

```ts
async function tool_<name>(inputs: { /* derived from inputSchema */ }): Promise<unknown> {
  // body translated from the graph's `code` field
}

const toolDefinitions = [
  {
    name: "<name>",
    description: "<description>",
    inputSchema: { /* same JSON Schema */ },
    fn: tool_<name>,
  },
];
```

**Python**

```python
def tool_<name>(inputs: dict) -> Any:
    # body translated from the graph's `code` field
    ...

tool_definitions = [
    {
        "name": "<name>",
        "description": "<description>",
        "input_schema": { ... },
        "fn": tool_<name>,
    },
]
```

### 4.3 Tool dispatch

After an LLM call returns `toolCalls`, dispatch them in parallel and append results to history.

**TypeScript**

```ts
const toolMessages = await Promise.all(
  toolCalls.map(async (call) => {
    const tool = toolDefinitions.find((t) => t.name === call.function.name);
    const args = JSON.parse(call.function.arguments);
    let content: string;
    try {
      const out = await tool.fn(args);
      content = typeof out === "string" ? out : JSON.stringify(out);
    } catch (e) {
      content = `error: ${(e as Error).message}`;
    }
    return { role: "tool", tool_call_id: call.id, content };
  })
);
const messagesAfterTools = [...messagesAfterLLM, ...toolMessages];
```

**Python**

```python
import asyncio, json

async def dispatch_one(call):
    tool = next(t for t in tool_definitions if t["name"] == call["function"]["name"])
    args = json.loads(call["function"]["arguments"])
    try:
        out = await tool["fn"](args) if asyncio.iscoroutinefunction(tool["fn"]) else tool["fn"](args)
        content = out if isinstance(out, str) else json.dumps(out)
    except Exception as e:
        content = f"error: {e}"
    return {"role": "tool", "tool_call_id": call["id"], "content": content}

tool_messages = await asyncio.gather(*[dispatch_one(c) for c in tool_calls])
messages_after_tools = [*messages_after_llm, *tool_messages]
```

### 4.4 Loop controller (declarative cycle)

A `loop-controller` with channel `messages` (the most common case) becomes a `while` loop.

**TypeScript**

```ts
let messages = initialMessages;          // from default-messages
let i = 1;
while (i <= maxIterations) {
  // ...body executes here, may compute newMessages and continueSignal...
  if (!continueSignal) break;
  messages = newMessages;                // wire that becomes input-messages
  i++;
}
```

**Python**

```python
messages = initial_messages              # from default-messages
i = 1
while i <= max_iterations:
    # ...body executes here, may compute new_messages and continue_signal...
    if not continue_signal:
        break
    messages = new_messages              # wire that becomes input-messages
    i += 1
```

For multiple channels, declare one variable per channel and update each at the end of the body.

### 4.5 Agent (LLM↔tool loop)

The `agent` node IS the §4.4 loop with a fixed body: LLM call → if no tool calls, halt → otherwise dispatch tools → repeat.

**TypeScript**

```ts
let messages = initialMessages;
let lastText = "";
for (let i = 1; i <= maxIterations; i++) {
  const { text, toolCalls } = await yourLLMClient.chat({ model, messages, tools, temperature, maxTokens });
  lastText = text;
  const assistantMsg = toolCalls.length > 0
    ? { role: "assistant", content: text, tool_calls: toolCalls }
    : { role: "assistant", content: text };
  messages = [...messages, assistantMsg];
  if (toolCalls.length === 0) break;     // stopCondition: no-tool-calls
  // dispatch (§4.3) and append tool messages:
  messages = [...messages, ...await dispatchTools(toolCalls)];
}
return { text: lastText, messages, iteration: i };
```

**Python**

```python
messages = initial_messages
last_text = ""
for i in range(1, max_iterations + 1):
    text, tool_calls = await your_llm_client.chat(model=model, messages=messages, tools=tools, temperature=temperature, max_tokens=max_tokens)
    last_text = text
    assistant_msg = {"role": "assistant", "content": text}
    if tool_calls:
        assistant_msg["tool_calls"] = tool_calls
    messages.append(assistant_msg)
    if not tool_calls:
        break                            # stopCondition: no-tool-calls
    messages.extend(await dispatch_tools(tool_calls))
return {"text": last_text, "messages": messages, "iteration": i}
```

### 4.6 Prompt template

```ts
// TS
const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
```

```python
# Python
def render(template, vars):
    import re
    return re.sub(r"\{\{(\w+)\}\}", lambda m: str(vars.get(m.group(1), "")), template)
```

### 4.6.5 File content wrapping (shared by file-input + chat attachments)

For each file that flows into the model's prompt — whether from a `file-input` node (§2.13) or a chat-sidebar attachment — wrap with this exact shape:

```
<file name="{filename}">
{utf-8 text content (or pdfjs-extracted text for pdfs)}
</file>
```

Multiple files concatenated with one blank line between blocks. No surrounding container — the model parses each `<file>` block independently. Use the same wrapper on both surfaces so the model sees a consistent shape.

**TypeScript:**

```ts
function wrapFileBlock(filename: string, content: string): string {
  const safe = filename.replace(/"/g, "&quot;");
  return `<file name="${safe}">\n${content}\n</file>`;
}
const composed = userText + "\n\n" + files.map(f => wrapFileBlock(f.name, f.content)).join("\n\n");
```

**Python:**

```python
def wrap_file_block(filename: str, content: str) -> str:
    safe = filename.replace('"', "&quot;")
    return f'<file name="{safe}">\n{content}\n</file>'

composed = user_text + "\n\n" + "\n\n".join(wrap_file_block(f["name"], f["content"]) for f in files)
```

The "extract" step (UTF-8 decode for txt/json, PDF text extraction for pdf) is whatever your project does — see §2.13. If the developer's environment doesn't have a PDF extractor, defer that one extension and document the limitation.

### 4.7 Transform

Per-mode mappings are in §2.10's table. The `custom` mode requires translating the embedded JS body to the host language; for trivial bodies (e.g. `return value.toLowerCase();`), this is mechanical. For non-trivial bodies, preserve the *behavior*, not the JS syntax.

## 5. Conventions for AI-generated code

When generating code from a graph, follow these defaults unless the developer has stated a preference:

1. **Use top-level `await`** in TypeScript, `asyncio.run(main())` in Python.
2. **One module per graph** by default. Larger graphs may justify splitting.
3. **Tools as plain functions**, registered into a list/dict by name.
4. **Messages as `Array<{role, content, tool_calls?, tool_call_id?}>`** — the OpenAI-compatible shape, since OpenRouter (the reference client) speaks it. If the developer uses Anthropic or another shape, document the mapping inline.
5. **No streaming** in generated code unless the developer asks. Streaming is a runtime concern that doesn't affect the workflow shape.
6. **Don't preserve node IDs or positions.** They are graph-only metadata.
7. **Don't preserve the Tool sandbox** (Web Worker, timeoutMs). Translate the JS body to a native function — the sandbox is a runtime safety boundary in the playground, not part of the logic.

## 6. Worked examples

### 6.1 Hello Model

**graph.json**

```json
{
  "schemaVersion": 1, "id": "tmpl-01-hello-model", "name": "Hello Model",
  "createdAt": "2026-05-02T00:00:00.000Z", "updatedAt": "2026-05-02T00:00:00.000Z",
  "containsCustomCode": false,
  "nodes": [
    { "id": "in", "type": "input", "position": {"x":60,"y":80},
      "config": { "name": "question", "defaultValue": "Tell me a fun fact about closures in JavaScript." } },
    { "id": "llm", "type": "llm-call", "position": {"x":360,"y":60},
      "config": { "model": "openai/gpt-oss-120b:free", "systemPrompt": "", "temperature": 0.7, "maxTokens": null, "responseFormat": null } },
    { "id": "out", "type": "output", "position": {"x":720,"y":80}, "config": { "format": "auto" } }
  ],
  "edges": [
    { "id": "e1", "source": "in",  "sourceHandle": "text", "target": "llm", "targetHandle": "text" },
    { "id": "e2", "source": "llm", "sourceHandle": "text", "target": "out", "targetHandle": "text" }
  ]
}
```

**TypeScript**

```ts
const question = "Tell me a fun fact about closures in JavaScript.";

const { text } = await yourLLMClient.chat({
  model: "openai/gpt-oss-120b:free",
  messages: [{ role: "user", content: question }],
  temperature: 0.7,
});

console.log(text);
```

**Python**

```python
question = "Tell me a fun fact about closures in JavaScript."

result = your_llm_client.chat(
    model="openai/gpt-oss-120b:free",
    messages=[{"role": "user", "content": question}],
    temperature=0.7,
)

print(result.text)
```

### 6.2 Encapsulated Agent (chat)

A `chat-input` → `agent` ← `tool` → `chat-output` graph compiles to:

**TypeScript**

```ts
async function handle(userMessage: string, history: Message[]): Promise<string> {
  const tools = [
    {
      name: "get_current_time",
      description: "Returns the current UTC time as ISO 8601.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      fn: async () => new Date().toISOString(),
    },
  ];

  let messages: Message[] = [
    { role: "system", content: "You are a helpful assistant. Use tools when needed." },
    ...history,
    { role: "user", content: userMessage },
  ];

  let lastText = "";
  for (let i = 1; i <= 25; i++) {
    const { text, toolCalls } = await yourLLMClient.chat({
      model: "openai/gpt-oss-120b:free",
      messages,
      tools: tools.map(({ fn, ...rest }) => rest),
      temperature: 0.7,
    });
    lastText = text;
    const assistantMsg = toolCalls.length
      ? { role: "assistant", content: text, tool_calls: toolCalls }
      : { role: "assistant", content: text };
    messages = [...messages, assistantMsg];
    if (toolCalls.length === 0) break;

    const toolMessages = await Promise.all(toolCalls.map(async (call) => {
      const t = tools.find((x) => x.name === call.function.name)!;
      const args = JSON.parse(call.function.arguments);
      const out = await t.fn(args);
      return { role: "tool", tool_call_id: call.id, content: typeof out === "string" ? out : JSON.stringify(out) };
    }));
    messages = [...messages, ...toolMessages];
  }
  return lastText;
}
```

**Python**

```python
import json
from datetime import datetime, timezone

async def handle(user_message: str, history: list[dict]) -> str:
    tools = [
        {
            "name": "get_current_time",
            "description": "Returns the current UTC time as ISO 8601.",
            "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
            "fn": lambda inputs: datetime.now(timezone.utc).isoformat(),
        },
    ]

    messages = [
        {"role": "system", "content": "You are a helpful assistant. Use tools when needed."},
        *history,
        {"role": "user", "content": user_message},
    ]

    last_text = ""
    for i in range(1, 26):
        text, tool_calls = await your_llm_client.chat(
            model="openai/gpt-oss-120b:free",
            messages=messages,
            tools=[{k: v for k, v in t.items() if k != "fn"} for t in tools],
            temperature=0.7,
        )
        last_text = text
        assistant_msg = {"role": "assistant", "content": text}
        if tool_calls:
            assistant_msg["tool_calls"] = tool_calls
        messages.append(assistant_msg)
        if not tool_calls:
            break

        for call in tool_calls:
            t = next(x for x in tools if x["name"] == call["function"]["name"])
            args = json.loads(call["function"]["arguments"])
            out = t["fn"](args)
            content = out if isinstance(out, str) else json.dumps(out)
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": content})

    return last_text
```

## 7. Reverse mapping (code → graph)

Given source code, identify these patterns and emit the matching node:

| Pattern in code | Emit node |
|---|---|
| Single chat-completion call, no surrounding loop | `llm-call` |
| `while` / `for` with a chat-completion call inside, halting on "no tool calls" | `agent` (preferred) or `loop-controller` + `llm-call` + `tool-runner` for explicit raw form |
| `while` / `for` with a chat-completion call AND a Critic-style follow-up call AND a halt regex on the verdict | `loop-controller` + two `llm-call`s + `transform` (regex-extract) on `continue` |
| Plain function exposed to the LLM as a tool | `tool` |
| Multiple tool-function lists merged into one | `tool-group` |
| Parallel loop dispatching `toolCalls` | `tool-runner` |
| `template.replace('{{name}}', ...)` or f-string built from upstream values | `prompt-template` |
| `JSON.parse` / `json.loads` of an upstream string | `transform` mode `json-parse` |
| Regex extraction returning a capture group | `transform` mode `regex-extract` |
| User-supplied JS-or-Python data shaping that doesn't fit the above modes | `transform` mode `custom` (TS) — port back to JS for the sandbox if you intend to round-trip |

**Wiring inference rules:**

1. Variables passed between calls become edges. Type inference: chat history → `messages`, tool definitions array → `tools`, LLM `toolCalls` field → `tool-calls`, anything else string-shaped → `string`, otherwise `json`.
2. The chat handler's `(userMessage, history)` parameters become `chat-input`'s `text` and `messages` outputs.
3. The handler's return value becomes `chat-output`.
4. A `while`/`for` loop becomes a `loop-controller`; each variable mutated inside the loop becomes a `valueChannel` whose initial value is the pre-loop assignment (`default-<name>`) and whose end-of-iteration value is the post-loop-body assignment (`input-<name>`).

## 8. What does NOT translate

- **Streaming UI updates.** The graph emits `onContentDelta` events for the inspector preview; these do not map to logic.
- **Per-iteration inspector state.** `IterationRecord` is a UX artifact, not part of the workflow.
- **The Tool / Transform sandbox.** Web Worker isolation is a playground safety feature; production tools run in your normal process.
- **Graph layout** (`position`, edge `id`, etc.).
- **Run history persistence.** Saved runs live next to the graph file in the playground; production code should use whatever persistence the host project provides.

## 9. Versioning

This spec describes `schemaVersion: 1`. If the schema bumps to 2 in a future release, this file will be updated in the same commit, and historical snapshots may be archived as `AGENTS-v1.md`.

The spec lives at `AGENTS.md` in the repo root. The wiki page at https://github.com/MatjazAkeo/agentforge/wiki points to this file as the source of truth.
