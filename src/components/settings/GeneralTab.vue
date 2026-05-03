<script setup lang="ts">
import { useSettingsStore, type ThemePref } from '@/stores/settings';

const settings = useSettingsStore();

function setTheme(t: ThemePref) {
  settings.theme = t;
}
function setDefaultModel(id: string) {
  settings.defaultModel = id || null;
}
</script>

<template>
  <div class="flex flex-col gap-3 text-xs">
    <label class="flex flex-col gap-1 opacity-85">
      Theme
      <select
        :value="settings.theme"
        @change="(e) => setTheme((e.target as HTMLSelectElement).value as ThemePref)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <div class="text-[11px] opacity-60">System follows your OS preference.</div>
    </label>

    <label class="flex flex-col gap-1 opacity-85">
      Default model
      <select
        :value="settings.defaultModel ?? ''"
        @change="(e) => setDefaultModel((e.target as HTMLSelectElement).value)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
        :disabled="settings.models.length === 0"
      >
        <option v-for="m in settings.models" :key="m.id" :value="m.id">{{ m.displayName }}</option>
        <option v-if="settings.models.length === 0" value="">— configure models first —</option>
      </select>
      <div class="text-[11px] opacity-60">Used as the initial model when you add a new LLM Call or Agent node.</div>
    </label>

    <label class="flex items-center gap-2 cursor-pointer opacity-85 mt-1">
      <input v-model="settings.autoLoadHelloModel" type="checkbox" class="cursor-pointer">
      <span>Auto-load "Hello Model" template on startup</span>
    </label>
    <div class="text-[11px] opacity-60 -mt-1.5 ml-6">
      When off, the app starts with an empty canvas instead.
    </div>
  </div>
</template>
