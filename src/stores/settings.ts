// src/stores/settings.ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { DEFAULT_MODELS } from '@/config/default-models';
import { fetchOpenRouterCredits } from '@/openrouter/credits';

export interface ModelEntry {
  id: string;
  displayName: string;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  notes: string;
  /** Per-token pricing (string decimals as OpenRouter returns them). "0" = free. */
  pricing?: { prompt: string; completion: string };
  /** Max context window in tokens. */
  contextLength?: number;
  /** OpenRouter modality string, e.g. 'text->text', 'text+image->text'. */
  modality?: string;
  /** OpenRouter `supported_parameters` list — e.g. ['temperature', 'tools', 'response_format']. */
  supportedParameters?: string[];
  /** Per OpenRouter `architecture.input_modalities` — e.g. ['text', 'image']. Empty/absent = text-only. */
  input_modalities?: string[];
}

export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'agent-playground.settings';

interface PersistedSettings {
  models: ModelEntry[];
  theme: ThemePref;
  defaultModel: string | null;
  autoLoadHelloModel: boolean;
  enableBetaUpdates: boolean;
}

function loadPersisted(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    return {
      models: Array.isArray(parsed.models) && parsed.models.length > 0 ? parsed.models : DEFAULT_MODELS,
      theme: parsed.theme ?? 'system',
      defaultModel: parsed.defaultModel ?? DEFAULT_MODELS[0]?.id ?? null,
      autoLoadHelloModel: parsed.autoLoadHelloModel ?? true,
      enableBetaUpdates: parsed.enableBetaUpdates ?? false,
    };
  } catch { return defaults(); }
}

function defaults(): PersistedSettings {
  return {
    models: [...DEFAULT_MODELS],
    theme: 'system',
    defaultModel: DEFAULT_MODELS[0]?.id ?? null,
    autoLoadHelloModel: true,
    enableBetaUpdates: false,
  };
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = loadPersisted();

  const apiKey = ref<string | null>(null);     // mirror, not source of truth
  const apiKeyConfigured = ref(false);
  const models = ref<ModelEntry[]>(initial.models);
  const theme = ref<ThemePref>(initial.theme);
  const defaultModel = ref<string | null>(initial.defaultModel);
  const autoLoadHelloModel = ref<boolean>(initial.autoLoadHelloModel);
  const enableBetaUpdates = ref<boolean>(initial.enableBetaUpdates);
  const credits = ref<number | null>(null);    // remaining USD on OpenRouter; null = not yet fetched

  function setApiKey(key: string | null) {
    apiKey.value = key;
    apiKeyConfigured.value = key !== null && key.length > 0;
  }

  async function refreshCredits() {
    if (!apiKey.value) {
      credits.value = null;
      return;
    }
    try {
      credits.value = await fetchOpenRouterCredits(apiKey.value);
    } catch (e) {
      // Don't clobber a previously known balance on a transient network failure.
      console.warn('Credit refresh failed:', e);
    }
  }

  function persist() {
    const data: PersistedSettings = {
      models: models.value,
      theme: theme.value,
      defaultModel: defaultModel.value,
      autoLoadHelloModel: autoLoadHelloModel.value,
      enableBetaUpdates: enableBetaUpdates.value,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore quota errors */ }
  }

  // Persist non-keychain settings on any change. apiKey lives in OS keychain only.
  watch([models, theme, defaultModel, autoLoadHelloModel, enableBetaUpdates], persist, { deep: true });

  function addModel(entry: ModelEntry) {
    if (models.value.some((m) => m.id === entry.id)) return;
    models.value = [...models.value, entry];
  }
  function removeModel(id: string) {
    models.value = models.value.filter((m) => m.id !== id);
    if (defaultModel.value === id) {
      defaultModel.value = models.value[0]?.id ?? null;
    }
  }
  function updateModelNotes(id: string, notes: string) {
    const i = models.value.findIndex((m) => m.id === id);
    if (i >= 0) models.value[i] = { ...models.value[i], notes };
  }

  return {
    apiKey, apiKeyConfigured, models, theme, defaultModel, autoLoadHelloModel,
    enableBetaUpdates, credits,
    setApiKey, addModel, removeModel, updateModelNotes, refreshCredits,
  };
});
