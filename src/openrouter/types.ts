export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
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
  message: ChatMessage;
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
