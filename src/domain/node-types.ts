// src/domain/node-types.ts
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
  | 'chat-output';

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
  mode: 'json-parse' | 'json-stringify' | 'json-path' | 'regex-extract' | 'template';
  /** json-path: dot-and-bracket path expression. Example: 'a.b[0].c' or 'messages[-1].content'. */
  path?: string;
  /** regex-extract: source pattern; flags applied automatically (g not used — single match). */
  pattern?: string;
  /** regex-extract: which capture group to return. 0 = whole match. */
  group?: number;
  /** template: a string with {{value}} placeholders rendered with the input value. */
  template?: string;
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

export interface LoopControllerConfig {
  maxIterations: number;            // default 25
  valueChannels: Array<{ name: string }>;  // declared state channels
}

export interface AgentConfig {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number | null;
  maxIterations: number;            // default 25
  stopCondition: 'no-tool-calls';   // only option in v1
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
  | Record<string, unknown>;
