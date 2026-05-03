import type { ModelEntry } from '@/stores/settings';

/**
 * Raw shape returned by `GET https://openrouter.ai/api/v1/models`.
 * Only the fields we actually consume are typed.
 */
export interface OpenRouterModelMeta {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt: string; completion: string };
  architecture?: { modality?: string };
  supported_parameters?: string[];
}

interface CatalogResponse {
  data: OpenRouterModelMeta[];
}

const BASE = 'https://openrouter.ai/api/v1';

let cached: OpenRouterModelMeta[] | null = null;

/**
 * Returns the OpenRouter model catalog. Cached per-session — reload to refresh.
 * The catalog endpoint is public; no API key required.
 */
export async function fetchOpenRouterCatalog(force = false): Promise<OpenRouterModelMeta[]> {
  if (cached && !force) return cached;
  const r = await fetch(`${BASE}/models`);
  if (!r.ok) {
    throw new Error(`OpenRouter catalog HTTP ${r.status}: ${r.statusText}`);
  }
  const body = (await r.json()) as CatalogResponse;
  cached = body.data ?? [];
  return cached;
}

/** Drop the in-memory cache, forcing the next fetch. */
export function clearCatalogCache(): void {
  cached = null;
}

/**
 * Convert an OpenRouter raw entry into our `ModelEntry`. `supportsTools` and
 * `supportsJsonMode` are derived from the `supported_parameters` array, which
 * is authoritative. `displayName` falls back to the id if no `name`.
 */
export function metaToEntry(meta: OpenRouterModelMeta): ModelEntry {
  const params = meta.supported_parameters ?? [];
  return {
    id: meta.id,
    displayName: meta.name ?? meta.id,
    supportsTools: params.includes('tools'),
    supportsJsonMode: params.includes('response_format'),
    notes: '',
    pricing: meta.pricing,
    contextLength: meta.context_length,
    modality: meta.architecture?.modality,
    supportedParameters: params,
  };
}

/** True iff both pricing fields are exactly "0" (the OpenRouter free-tier marker). */
export function isFree(meta: OpenRouterModelMeta): boolean {
  return meta.pricing?.prompt === '0' && meta.pricing?.completion === '0';
}
