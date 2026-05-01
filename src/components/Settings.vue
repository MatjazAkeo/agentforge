<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { saveApiKey, deleteApiKey } from '@/secrets/api-key';

const ui = useUiStore();
const settings = useSettingsStore();
const tab = ref<'api-key' | 'models' | 'general'>('api-key');
const draft = ref(settings.apiKey ?? '');
const testing = ref(false);
const testResult = ref<string | null>(null);

async function onSave() {
  await saveApiKey(draft.value);
  settings.setApiKey(draft.value);
  testResult.value = 'Saved.';
}

async function onClear() {
  await deleteApiKey();
  settings.setApiKey(null);
  draft.value = '';
  testResult.value = 'Cleared.';
}

async function onTest() {
  testing.value = true;
  testResult.value = null;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${draft.value}` },
    });
    testResult.value = r.ok ? `Connected (HTTP ${r.status})` : `Failed (HTTP ${r.status})`;
  } catch (e) {
    testResult.value = `Error: ${(e as Error).message}`;
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <div class="settings-overlay" @click.self="ui.settingsOpen = false">
    <div class="settings-panel">
      <div class="header">
        <h2>Settings</h2>
        <button class="close" @click="ui.settingsOpen = false">✕</button>
      </div>
      <div class="tabs">
        <button :class="['tab', { active: tab === 'api-key' }]" @click="tab = 'api-key'">API Key</button>
        <button :class="['tab', { active: tab === 'models' }]" @click="tab = 'models'" disabled>Models</button>
        <button :class="['tab', { active: tab === 'general' }]" @click="tab = 'general'" disabled>General</button>
      </div>
      <div class="body" v-if="tab === 'api-key'">
        <label>OpenRouter API Key
          <input v-model="draft" placeholder="sk-or-v1-…" type="password">
        </label>
        <p class="hint">Don't have a key? <a href="https://openrouter.ai/" target="_blank">Sign up at OpenRouter →</a></p>
        <div class="actions">
          <button class="btn" :disabled="testing || !draft" @click="onTest">
            {{ testing ? 'Testing…' : 'Test connection' }}
          </button>
          <button class="btn btn-primary" :disabled="!draft" @click="onSave">Save</button>
          <button class="btn btn-danger" :disabled="!settings.apiKeyConfigured" @click="onClear">Clear</button>
        </div>
        <p v-if="testResult" class="result">{{ testResult }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.settings-panel { width: 480px; max-width: 90vw; background: var(--bg-panel); border: 1px solid var(--border-strong); border-radius: 8px; padding: 16px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.header h2 { margin: 0; font-size: 16px; }
.close { background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 16px; }
.tabs { display: flex; gap: 6px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
.tab { padding: 6px 12px; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 12px; }
.tab.active { color: var(--text); border-bottom: 2px solid var(--accent); }
.tab:disabled { opacity: 0.4; cursor: not-allowed; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
input { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; font-family: var(--font-ui); font-size: 13px; }
.hint { font-size: 11px; opacity: 0.7; }
.hint a { color: var(--accent); }
.actions { display: flex; gap: 6px; margin-top: 8px; }
.btn { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border-strong); border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 12px; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
.btn-danger { color: var(--error); }
.result { margin-top: 8px; font-size: 12px; opacity: 0.8; }
</style>
