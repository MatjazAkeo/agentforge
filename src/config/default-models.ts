import type { ModelEntry } from '@/stores/settings';

export const DEFAULT_MODELS: ModelEntry[] = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', displayName: 'Llama 3.3 70B (free)', supportsTools: true, supportsJsonMode: true, notes: '' },
  { id: 'deepseek/deepseek-chat-v3:free', displayName: 'DeepSeek Chat v3 (free)', supportsTools: true, supportsJsonMode: true, notes: '' },
  { id: 'google/gemini-2.0-flash-exp:free', displayName: 'Gemini 2.0 Flash (free)', supportsTools: true, supportsJsonMode: false, notes: 'Tool support intermittent on free tier' },
  { id: 'mistralai/mistral-7b-instruct:free', displayName: 'Mistral 7B Instruct (free)', supportsTools: false, supportsJsonMode: false, notes: 'No tool support' },
];
