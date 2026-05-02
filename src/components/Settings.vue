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
  await saveApiKey(draft.value.trim());
  settings.setApiKey(draft.value.trim());
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
      headers: { Authorization: `Bearer ${draft.value.trim()}` },
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
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]"
    @click.self="ui.settingsOpen = false"
  >
    <div class="w-[480px] max-w-[90vw] bg-panel border border-border-strong rounded-lg p-4">
      <div class="flex justify-between items-center mb-3">
        <h2 class="m-0 text-base">Settings</h2>
        <button
          type="button"
          class="bg-transparent border-0 text-text-dim cursor-pointer text-base"
          @click="ui.settingsOpen = false"
        >✕</button>
      </div>
      <div class="flex gap-1.5 mb-4 border-b border-border-base">
        <button
          type="button"
          @click="tab = 'api-key'"
          :class="[
            'px-3 py-1.5 bg-transparent border-0 cursor-pointer text-xs border-b-2',
            tab === 'api-key' ? 'text-text-base border-accent' : 'text-text-dim border-transparent',
          ]"
        >API Key</button>
        <button
          type="button"
          disabled
          class="px-3 py-1.5 bg-transparent border-0 text-text-dim text-xs border-b-2 border-transparent opacity-40 cursor-not-allowed"
        >Models</button>
        <button
          type="button"
          disabled
          class="px-3 py-1.5 bg-transparent border-0 text-text-dim text-xs border-b-2 border-transparent opacity-40 cursor-not-allowed"
        >General</button>
      </div>
      <div v-if="tab === 'api-key'">
        <label class="flex flex-col gap-1 text-xs">
          OpenRouter API Key
          <input
            v-model="draft"
            placeholder="sk-or-v1-…"
            type="password"
            class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 font-ui text-[13px]"
          >
        </label>
        <p class="text-[11px] opacity-70 mt-2">
          Don't have a key? <a class="text-accent" href="https://openrouter.ai/" target="_blank">Sign up at OpenRouter →</a>
        </p>
        <div class="flex gap-1.5 mt-2">
          <button
            type="button"
            :disabled="testing || !draft.trim()"
            @click="onTest"
            class="bg-elev text-text-base border border-border-strong rounded px-3 py-1.5 cursor-pointer text-xs transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >{{ testing ? 'Testing…' : 'Test connection' }}</button>
          <button
            type="button"
            :disabled="!draft.trim()"
            @click="onSave"
            class="bg-accent text-white border border-accent rounded px-3 py-1.5 cursor-pointer text-xs transition disabled:bg-elev disabled:text-text-dim disabled:border-border-strong disabled:cursor-not-allowed disabled:opacity-50"
          >Save</button>
          <button
            type="button"
            :disabled="!settings.apiKeyConfigured"
            @click="onClear"
            class="bg-elev text-error border border-border-strong rounded px-3 py-1.5 cursor-pointer text-xs transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >Clear</button>
        </div>
        <p v-if="testResult" class="mt-2 text-xs opacity-80">{{ testResult }}</p>
      </div>
    </div>
  </div>
</template>
