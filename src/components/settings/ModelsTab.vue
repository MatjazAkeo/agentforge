<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSettingsStore, type ModelEntry } from '@/stores/settings';
import {
  fetchOpenRouterCatalog,
  fetchModelEndpoints,
  bestUptime,
  metaToEntry,
  isFree,
  type OpenRouterModelMeta,
} from '@/openrouter/catalog';

const settings = useSettingsStore();

const search = ref('');
const onlyFree = ref(false);
const onlyTools = ref(false);
const onlyVision = ref(false);

const catalog = ref<OpenRouterModelMeta[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Per-model uptime, fetched lazily for configured models only. Range 0..1, or
// null while loading or if no provider reports uptime.
const uptimes = ref<Record<string, number | null>>({});

async function loadUptimeForConfigured() {
  await Promise.all(
    settings.models.map(async (m) => {
      if (m.id in uptimes.value) return; // already attempted
      try {
        const eps = await fetchModelEndpoints(m.id);
        uptimes.value = { ...uptimes.value, [m.id]: bestUptime(eps) };
      } catch (err) {
        console.warn(`Uptime fetch failed for ${m.id}:`, err);
        uptimes.value = { ...uptimes.value, [m.id]: null };
      }
    }),
  );
}

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    catalog.value = await fetchOpenRouterCatalog();
    // Re-enrich configured models from the fresh catalog so chips like
    // ctx / vision / pricing reflect the latest metadata even for models
    // that were added before those fields existed.
    settings.enrichModelsFromCatalog(catalog.value.map(metaToEntry));
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
  // Fetch uptime for configured models in parallel — bounded list, fire-and-forget.
  void loadUptimeForConfigured();
});

const configuredIds = computed(() => new Set(settings.models.map((m) => m.id)));

const filteredCatalog = computed(() => {
  const q = search.value.trim().toLowerCase();
  return catalog.value.filter((m) => {
    if (configuredIds.value.has(m.id)) return false; // hide already-configured
    if (onlyFree.value && !isFree(m)) return false;
    if (onlyTools.value && !(m.supported_parameters ?? []).includes('tools')) return false;
    if (onlyVision.value && !(m.architecture?.input_modalities ?? []).includes('image')) return false;
    if (q) {
      const hay = `${m.id} ${m.name ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

function formatPrice(p?: { prompt: string; completion: string }): string {
  if (!p) return '';
  if (p.prompt === '0' && p.completion === '0') return 'Free';
  // OpenRouter pricing is per-token in scientific notation strings; convert to per-1M for readability.
  const perM = (s: string) => {
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    const million = n * 1_000_000;
    return million < 0.01 ? million.toFixed(4) : million.toFixed(2);
  };
  return `$${perM(p.prompt)} / $${perM(p.completion)} per 1M`;
}

function ctxChip(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ctx`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K ctx`;
  return `${n} ctx`;
}

function onAdd(meta: OpenRouterModelMeta) {
  settings.addModel(metaToEntry(meta));
  // Kick off uptime fetch for the newly added model.
  void loadUptimeForConfigured();
}

/**
 * Returns the uptime chip label for a model, or null if the model hasn't been
 * fetched yet (still loading). Returns "uptime n/a" when the fetch completed
 * but no provider reported `uptime_last_30m` — common for newly-listed free
 * proxies. OpenRouter returns the value as a percentage (e.g. 99.901), not a
 * fraction.
 */
function uptimeChip(modelId: string): string | null {
  if (!(modelId in uptimes.value)) return null; // still loading — no chip
  const u = uptimes.value[modelId];
  if (u === null) return 'uptime n/a';
  return `${u.toFixed(1)}% uptime`;
}

function uptimeColor(modelId: string): string {
  const u = uptimes.value[modelId];
  if (u === null || u === undefined) return 'text-text-dim';
  if (u >= 99) return 'text-success';
  if (u >= 95) return 'text-warn';
  return 'text-error';
}

function onRemove(id: string) {
  settings.removeModel(id);
}

function onUpdateNotes(e: Event, id: string) {
  settings.updateModelNotes(id, (e.target as HTMLInputElement).value);
}

const searchInputs = ref<Record<string, string>>({});
function noteValue(m: ModelEntry): string {
  return searchInputs.value[m.id] ?? m.notes;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Filters -->
    <div class="flex items-center gap-2 text-xs">
      <input
        v-model="search"
        placeholder="Search models…"
        class="flex-1 min-w-0 bg-elev text-text-base border border-border-base rounded px-2 py-1.5"
      >
      <label class="flex items-center gap-1 cursor-pointer">
        <input v-model="onlyFree" type="checkbox" class="cursor-pointer">
        <span>Free only</span>
      </label>
      <label class="flex items-center gap-1 cursor-pointer">
        <input v-model="onlyTools" type="checkbox" class="cursor-pointer">
        <span>Supports tools</span>
      </label>
      <label class="flex items-center gap-1 cursor-pointer">
        <input v-model="onlyVision" type="checkbox" class="cursor-pointer">
        <span>Vision</span>
      </label>
    </div>

    <!-- Configured models -->
    <section>
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1.5">
        Configured ({{ settings.models.length }})
      </div>
      <ul v-if="settings.models.length > 0" class="flex flex-col gap-1.5">
        <li
          v-for="m in settings.models" :key="m.id"
          class="bg-panel border border-border-base rounded px-2.5 py-2 text-xs"
        >
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ m.displayName }}</div>
              <div class="text-text-dim font-mono text-[10px] truncate">{{ m.id }}</div>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-if="m.supportsTools" class="px-1.5 py-0.5 rounded bg-[#ffd54a]/20 text-[#ffd54a] text-[10px]">tools</span>
                <span v-if="m.supportsJsonMode" class="px-1.5 py-0.5 rounded bg-[#4ad7e2]/20 text-[#4ad7e2] text-[10px]">json mode</span>
                <span v-if="(m.input_modalities ?? []).includes('image')" class="px-1.5 py-0.5 rounded bg-[#7ad48c]/20 text-[#7ad48c] text-[10px]" title="Accepts image inputs">vision</span>
                <span v-if="m.contextLength" class="px-1.5 py-0.5 rounded bg-elev text-text-dim text-[10px]">{{ ctxChip(m.contextLength) }}</span>
                <span v-if="m.modality && m.modality !== 'text->text'" class="px-1.5 py-0.5 rounded bg-elev text-text-dim text-[10px]">{{ m.modality }}</span>
                <span v-if="m.pricing" class="px-1.5 py-0.5 rounded bg-elev text-text-dim text-[10px]">{{ formatPrice(m.pricing) }}</span>
                <span
                  v-if="uptimeChip(m.id)"
                  :class="['px-1.5 py-0.5 rounded bg-elev text-[10px]', uptimeColor(m.id)]"
                  title="Best provider uptime over last 30 minutes"
                >{{ uptimeChip(m.id) }}</span>
              </div>
              <input
                :value="noteValue(m)"
                @input="(e) => onUpdateNotes(e, m.id)"
                placeholder="Notes (e.g. 'good for code')"
                class="mt-2 w-full bg-elev text-text-base border border-border-base rounded px-1.5 py-1 text-[11px]"
              >
            </div>
            <button
              type="button" @click="onRemove(m.id)"
              class="bg-elev text-error border border-border-strong rounded px-2 py-1 cursor-pointer text-[11px] hover:bg-error/15 flex-shrink-0"
            >Remove</button>
          </div>
        </li>
      </ul>
      <div v-else class="text-xs opacity-50 italic">No models configured. Add some from the catalog below.</div>
    </section>

    <!-- Available models from OpenRouter -->
    <section>
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1.5">
        Available on OpenRouter
        <span v-if="!loading && !error">({{ filteredCatalog.length }})</span>
      </div>
      <div v-if="loading" class="text-xs opacity-60 italic">Loading catalog…</div>
      <div v-else-if="error" class="text-xs text-error">
        Couldn't reach OpenRouter: {{ error }}
        <br><span class="opacity-60">You can still configure your local list manually.</span>
      </div>
      <div v-else-if="filteredCatalog.length === 0" class="text-xs opacity-50 italic">
        No matches.
      </div>
      <ul v-else class="flex flex-col gap-1 max-h-[340px] overflow-y-auto pr-1">
        <li
          v-for="m in filteredCatalog" :key="m.id"
          class="bg-panel/40 border border-border-base/60 rounded px-2.5 py-1.5 text-xs"
        >
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ m.name ?? m.id }}</div>
              <div class="text-text-dim font-mono text-[10px] truncate">{{ m.id }}</div>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-if="(m.supported_parameters ?? []).includes('tools')" class="px-1.5 py-0.5 rounded bg-[#ffd54a]/20 text-[#ffd54a] text-[10px]">tools</span>
                <span v-if="(m.supported_parameters ?? []).includes('response_format')" class="px-1.5 py-0.5 rounded bg-[#4ad7e2]/20 text-[#4ad7e2] text-[10px]">json mode</span>
                <span v-if="(m.architecture?.input_modalities ?? []).includes('image')" class="px-1.5 py-0.5 rounded bg-[#7ad48c]/20 text-[#7ad48c] text-[10px]" title="Accepts image inputs">vision</span>
                <span v-if="m.context_length" class="px-1.5 py-0.5 rounded bg-elev text-text-dim text-[10px]">{{ ctxChip(m.context_length) }}</span>
                <span v-if="m.architecture?.modality && m.architecture.modality !== 'text->text'" class="px-1.5 py-0.5 rounded bg-elev text-text-dim text-[10px]">{{ m.architecture.modality }}</span>
                <span v-if="m.pricing" class="px-1.5 py-0.5 rounded bg-elev text-text-dim text-[10px]">{{ formatPrice(m.pricing) }}</span>
              </div>
            </div>
            <button
              type="button" @click="onAdd(m)"
              class="bg-accent text-white border border-accent rounded px-2 py-1 cursor-pointer text-[11px] hover:opacity-90 flex-shrink-0"
            >+ Add</button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
