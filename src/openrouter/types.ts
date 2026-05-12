import type { Context, ContentPart } from '@/domain/context';
export type { Context, ContentPart };

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatCompletionRequest {
  model: string;
  messages: Context[];
  temperature?: number;
  max_tokens?: number | null;
  stream?: boolean;
  response_format?: { type: 'json_object' } | undefined;
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }>;
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  parallel_tool_calls?: boolean;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export interface ChatCompletionChoice {
  index: number;
  message: Context;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
}

export interface StreamDelta {
  content?: string;
  tool_calls?: Array<Partial<ToolCall> & { index: number }>;
  role?: string;
}

export interface StreamChunk {
  choices: Array<{ delta: StreamDelta; finish_reason?: string }>;
  usage?: ChatCompletionUsage;
}
