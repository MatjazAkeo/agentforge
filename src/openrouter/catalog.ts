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
  architecture?: { modality?: string; input_modalities?: string[] };
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
    input_modalities: meta.architecture?.input_modalities,
    supportedParameters: params,
  };
}

/** True iff both pricing fields are exactly "0" (the OpenRouter free-tier marker). */
export function isFree(meta: OpenRouterModelMeta): boolean {
  return meta.pricing?.prompt === '0' && meta.pricing?.completion === '0';
}

/** One provider serving a model, as returned by /api/v1/models/{id}/endpoints. */
export interface OpenRouterEndpoint {
  name?: string;
  provider_name?: string;
  /** Uptime percentage over the last 30 min, range 0..100 (e.g. 99.9). */
  uptime_last_30m?: number;
  status?: number;
}

interface EndpointsResponse {
  data?: { endpoints?: OpenRouterEndpoint[] };
}

const endpointsCache = new Map<string, OpenRouterEndpoint[]>();

/**
 * Returns the providers serving `modelId`, including per-provider uptime stats.
 * Cached per session by model id. Use this only for CONFIGURED models — fetching
 * for the entire catalog would be 400+ HTTP requests.
 */
export async function fetchModelEndpoints(modelId: string): Promise<OpenRouterEndpoint[]> {
  const hit = endpointsCache.get(modelId);
  if (hit) return hit;
  // OpenRouter's URL pattern is /models/{author}/{slug}/endpoints — the `/` is
  // structural, not part of the slug. Don't encodeURIComponent the whole id, or
  // `/` becomes %2F and the request 404s.
  const r = await fetch(`${BASE}/models/${modelId}/endpoints`);
  if (!r.ok) throw new Error(`endpoints HTTP ${r.status}`);
  const body = (await r.json()) as EndpointsResponse;
  const eps = body.data?.endpoints ?? [];
  endpointsCache.set(modelId, eps);
  return eps;
}

/**
 * Best uptime across all providers serving this model, as a fraction 0..1.
 * Returns `null` if no provider reports uptime.
 */
export function bestUptime(endpoints: OpenRouterEndpoint[]): number | null {
  let best: number | null = null;
  for (const e of endpoints) {
    if (typeof e.uptime_last_30m === 'number') {
      if (best === null || e.uptime_last_30m > best) best = e.uptime_last_30m;
    }
  }
  return best;
}
