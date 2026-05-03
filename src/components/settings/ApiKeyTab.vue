<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { saveApiKey, deleteApiKey } from '@/secrets/api-key';

const settings = useSettingsStore();
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
  <div>
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
</template>
