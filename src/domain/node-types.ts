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
  | 'break'
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

export interface LoopControllerConfig {
  maxIterations: number;            // default 25
  valueChannels: Array<{ name: string }>;  // declared state channels
}

export interface BreakConfig {
  // intentionally empty — Break is a passthrough
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
  | LoopControllerConfig
  | BreakConfig
  | AgentConfig
  | Record<string, unknown>;
