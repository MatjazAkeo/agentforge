<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore, type ThemePref } from '@/stores/settings';
import { modelOptionsForDropdown } from '@/config/virtual-models';

const settings = useSettingsStore();
const modelOptions = computed(() => modelOptionsForDropdown(settings.models));

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
      >
        <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.displayName }}</option>
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

    <label class="flex items-center gap-2 cursor-pointer opacity-85 mt-1">
      <input v-model="settings.enableBetaUpdates" type="checkbox" class="cursor-pointer">
      <span>Receive beta releases</span>
    </label>
    <div class="text-[11px] opacity-60 -mt-1.5 ml-6">
      Auto-update will install pre-release versions tagged <code class="font-mono">-beta</code>,
      <code class="font-mono">-alpha</code>, <code class="font-mono">-rc</code>,
      <code class="font-mono">-dev</code>, or <code class="font-mono">-canary</code>. Off by default —
      stable releases only.
    </div>
  </div>
</template>
