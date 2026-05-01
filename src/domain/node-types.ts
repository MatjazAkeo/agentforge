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
  valueType: 'text' | 'number' | 'json';
  defaultValue: unknown;
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

// Plan 1 defines only these three. Other node-type configs come in later plans
// but the union type is declared up-front for stability.
export type NodeConfig = InputConfig | OutputConfig | LLMCallConfig | Record<string, unknown>;
