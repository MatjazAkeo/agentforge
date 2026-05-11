// src/domain/node-types.ts
import type { ImageMime } from './images';

export type NodeType =
  | 'input'
  | 'output'
  | 'llm-call'
  | 'tool'
  | 'tool-group'
  | 'tool-runner'
  | 'prompt-template'
  | 'transform'
  | 'loop-controller'
  | 'agent'
  | 'chat-input'
  | 'chat-output'
  | 'file-input'
  | 'tool-pack';

export interface InputConfig {
  name: string;
  defaultValue: string;
}

export interface OutputConfig {
  format: 'auto' | 'text' | 'json' | 'markdown';
}

export interface LLMCallConfig {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number | null;
  responseFormat: 'text' | 'json_object' | null;
  imagesPortMode?: 'auto' | 'force-on' | 'force-off';
}

export interface ToolConfig {
  name: string;                                    // snake_case identifier exposed to the LLM
  description: string;                             // prompt-visible description
  inputSchema: Record<string, unknown>;            // JSON Schema for the tool's `inputs` arg
  code: string;                                    // user-authored JS function body
  timeoutMs: number;                               // per-invocation safety cap
}

export interface ToolGroupConfig {
  label: string;                                   // shown on the node card; cosmetic only
}

export interface ToolRunnerConfig {
  // No config — behavior fully driven by inputs.
}

export interface TransformConfig {
  mode: 'json-parse' | 'json-stringify' | 'json-path' | 'regex-extract' | 'template' | 'custom';
  /** json-path: dot-and-bracket path expression. Example: 'a.b[0].c' or 'messages[-1].content'. */
  path?: string;
  /** regex-extract: source pattern; flags applied automatically (g not used — single match). */
  pattern?: string;
  /** regex-extract: which capture group to return. 0 = whole match. */
  group?: number;
  /** template: a string with {{value}} placeholders rendered with the input value. */
  template?: string;
  /** custom: a JS function body that receives `value` and returns the result.
   *  Synchronous — no await, no fetch, no I/O. */
  code?: string;
}

export interface PromptTemplateConfig {
  template: string;  // contains {{var}} placeholders
}

export interface ChatInputConfig {
  // intentionally empty — the chat sidebar provides the runtime session
}

export interface ChatOutputConfig {
  format: 'text' | 'markdown';
}

/**
 * `LoopChannelType` is the wire-type of a single declared channel. It maps 1:1 to
 * `DataType` from `port-types.ts`. Declared per-channel so the LC card's ports
 * (`default-X`, `input-X`, `output-X`) get the right color and validate against the
 * right shape, instead of all defaulting to the polymorphic `json` wildcard.
 */
export type LoopChannelType = 'string' | 'messages' | 'tools' | 'tool-calls' | 'json';

export interface LoopControllerConfig {
  maxIterations: number;            // default 25
  /** State channels that flow through the loop. Each declares a type so the
   *  three derived ports (`default-<name>`, `input-<name>`, `output-<name>`)
   *  validate consistently. Omitted `type` defaults to `json` (universal). */
  valueChannels: Array<{ name: string; type?: LoopChannelType }>;
}

export interface AgentConfig {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number | null;
  maxIterations: number;            // default 25
  stopCondition: 'no-tool-calls';   // only option in v1
  imagesPortMode?: 'auto' | 'force-on' | 'force-off';
  /** Constrains the model's `content` field across every iteration. Tool calls
   *  are already structured in the API; JSON mode only affects assistant text. */
  responseFormat?: 'text' | 'json_object' | null;
}

export interface FileInputConfig {
  files: Array<{
    /** Basename used in <graph>.assets/. May include a -2/-3 suffix on collision. */
    filename: string;
    /** Recorded at attach time, used for size guardrail and inspector display. */
    sizeBytes: number;
    /** Original absolute path on the user's machine, for display only. */
    sourcePath?: string;
    /** File kind discriminator. Defaults to 'text' if omitted. */
    kind?: 'text' | 'image';
    /** MIME type for image entries. Only set when kind === 'image'. */
    mime?: ImageMime;
  }>;
}

export interface ToolPackTool {
  /** Tool name as the LLM sees it. Snake_case or kebab-case, [a-zA-Z0-9_-]+. */
  name: string;
  /** Description shown to the LLM. Authors paste schema info here for v1. */
  description: string;
  /** JSON Schema for the tool's arguments. Validated leniently — invalid
   *  schemas warn but don't block saves. */
  inputSchema: Record<string, unknown>;
  /** JS function body. `inputs` (validated args) and `sqlite` (helper) are in scope. */
  code: string;
  /** Author-controlled cap on rows returned by sqlite.query. Falls back to 1000. */
  maxRows?: number;
}

export interface ToolPackConfig {
  /** 'none' = plain tool list, no helper bound. 'sqlite' = SQLite-backed. */
  flavor: 'none' | 'sqlite';
  /** Shape determined by flavor. SQLite: { db, sourcePath?, sizeBytes }. None: {}. */
  connection: Record<string, unknown>;
  tools: ToolPackTool[];
}

// Plan 1 defines only these three. Other node-type configs come in later plans
// but the union type is declared up-front for stability.
export type NodeConfig =
  | InputConfig
  | OutputConfig
  | LLMCallConfig
  | ToolConfig
  | ToolGroupConfig
  | ToolRunnerConfig
  | TransformConfig
  | PromptTemplateConfig
  | ChatInputConfig
  | ChatOutputConfig
  | LoopControllerConfig
  | AgentConfig
  | FileInputConfig
  | ToolPackConfig
  | Record<string, unknown>;
