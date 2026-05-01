// src/stores/settings.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ModelEntry {
  id: string;
  displayName: string;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  notes: string;
}

export const useSettingsStore = defineStore('settings', () => {
  const apiKey = ref<string | null>(null);     // mirror, not source of truth
  const apiKeyConfigured = ref(false);
  const models = ref<ModelEntry[]>([]);
  const theme = ref<'light' | 'dark' | 'system'>('system');

  function setApiKey(key: string | null) {
    apiKey.value = key;
    apiKeyConfigured.value = key !== null && key.length > 0;
  }

  return { apiKey, apiKeyConfigured, models, theme, setApiKey };
});
