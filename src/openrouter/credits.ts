// src/openrouter/credits.ts
//
// OpenRouter account balance + per-call cost estimation.
//
// Balance comes from `GET /api/v1/credits`. Per-call cost is computed locally
// from the cached model catalog's pricing (per-token strings) — much faster
// than hitting `/generation?id=...` per call, accurate enough for a header
// chip.
import type { ModelEntry } from '@/stores/settings';

const BASE = 'https://openrouter.ai/api/v1';

interface CreditsResponse {
  data?: {
    total_credits?: number | string;
    total_usage?: number | string;
  };
}

function asNumber(v: number | string | undefined): number {
  if (v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fetches the user's OpenRouter balance. Returns remaining credits in USD
 * (total_credits - total_usage). Throws on network/HTTP error so callers can
 * decide whether to suppress.
 */
export async function fetchOpenRouterCredits(apiKey: string): Promise<number> {
  const r = await fetch(`${BASE}/credits`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) {
    throw new Error(`OpenRouter credits HTTP ${r.status}: ${r.statusText}`);
  }
  const body = (await r.json()) as CreditsResponse;
  const total = asNumber(body.data?.total_credits);
  const used = asNumber(body.data?.total_usage);
  return total - used;
}

/**
 * Local cost estimate in USD for a single LLM call, given the model's catalog
 * pricing. Returns 0 if the model is missing pricing or the model is free.
 *
 * OpenRouter pricing is per-token (string-encoded decimals like "0.000001").
 */
export function estimateCallCostUsd(
  model: ModelEntry | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!model?.pricing) return 0;
  const pIn = parseFloat(model.pricing.prompt);
  const pOut = parseFloat(model.pricing.completion);
  if (!Number.isFinite(pIn) || !Number.isFinite(pOut)) return 0;
  return inputTokens * pIn + outputTokens * pOut;
}
