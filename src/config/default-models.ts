import type { ModelEntry } from '@/stores/settings';

// OpenRouter's free tier rotates often — model ids that worked last quarter may be retired or
// have a different exact suffix today. The two below have been the most stable; add more via
// the Settings → Models tab (Plan 4). To find current free model ids, browse:
//   https://openrouter.ai/models?max_price=0
export const DEFAULT_MODELS: ModelEntry[] = [
  { id: 'openai/gpt-oss-120b:free', displayName: 'GPT-OSS 120B (free)', supportsTools: true, supportsJsonMode: true, notes: '' },
];
