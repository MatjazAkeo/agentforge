<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { useUpdateStore } from '@/stores/update';
import { runGraph } from '@/engine/runner';
import { abortCurrent } from '@/engine/abort';
import TemplatePickerModal from './TemplatePickerModal.vue';
import type { BundledTemplate } from '@/templates';

const graph = useGraphStore();
const run = useRunStore();
const ui = useUiStore();
const settings = useSettingsStore();
const updateStore = useUpdateStore();

const templatesOpen = ref(false);

function onPickTemplate(tpl: BundledTemplate) {
  const cloned = JSON.parse(JSON.stringify(tpl.graph));
  // Generate a fresh id so two graphs spawned from the same template don't
  // collide. The template file's id ('tmpl-...') is just an authoring marker.
  cloned.id = crypto.randomUUID();
  graph.load(cloned, null);
  templatesOpen.value = false;
}

const displayName = computed(() => {
  const path = graph.filePath;
  if (!path) return 'Untitled';
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1];
});

const elapsedDisplay = computed(() => {
  const ms = run.elapsedMs;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});

const costDisplay = computed(() => {
  const c = run.totalCostUsd;
  if (c >= 1) return `$${c.toFixed(2)}`;
  return `$${c.toFixed(4)}`;
});

const creditsDisplay = computed(() => {
  const v = settings.credits;
  if (v === null || v === undefined) return '— credits';
  return `$${v.toFixed(2)}`;
});

function openSettings() { ui.settingsOpen = true; }

async function onRun() {
  if (!settings.apiKeyConfigured) {
    alert('Add an OpenRouter API key in Settings first.');
    return;
  }
  try {
    const result = await runGraph({ graph: graph.graph, apiKey: settings.apiKey ?? '' });
    if (result.status === 'failed' && result.errors.length > 0) {
      const first = result.errors[0];
      // Defer so Vue's render queue flushes (timer / spinner / pulse all relax) BEFORE
      // alert() blocks the thread and freezes the UI mid-update.
      setTimeout(() => {
        alert(`Run failed at node ${first.nodeId.slice(0, 8)}…\n\n${first.message}`);
      }, 0);
    }
  } catch (err) {
    console.error('Run failed:', err);
    setTimeout(() => alert(`Run failed: ${(err as Error).message ?? String(err)}`), 0);
  }
  // Refresh balance regardless of run outcome — even partial spend should reflect.
  void settings.refreshCredits();
}
function onStop() { abortCurrent(); }
</script>

<template>
  <header class="flex items-center gap-3 px-3.5 py-2.5 bg-panel border-b border-border-base text-sm">
    <div class="flex items-center gap-1">
      <strong>{{ displayName }}</strong>
      <span v-if="graph.dirty" class="text-accent ml-1" title="Unsaved changes">●</span>
    </div>
    <div v-if="run.current" class="flex gap-3 opacity-85">
      <span class="tabular-nums">api calls: <strong>{{ run.totalApiCalls }}</strong></span>
      <span class="tabular-nums">in: <strong>{{ run.totalTokensIn }}</strong></span>
      <span class="tabular-nums">out: <strong>{{ run.totalTokensOut }}</strong></span>
      <span class="tabular-nums">⏱ <strong>{{ elapsedDisplay }}</strong></span>
      <span v-if="run.totalCostUsd > 0" class="tabular-nums">cost: <strong>{{ costDisplay }}</strong></span>
    </div>
    <div class="ml-auto flex gap-1.5 items-center">
      <button
        v-if="updateStore.update"
        type="button"
        @click="updateStore.openModal()"
        title="Update available — click for details"
        class="h-9 inline-flex items-center px-3 rounded border border-accent bg-accent/15 text-accent cursor-pointer hover:bg-accent/25 font-semibold"
      >
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-1.5 align-middle animate-pulse" />Update
      </button>
      <button
        type="button"
        @click="templatesOpen = true"
        class="h-9 inline-flex items-center px-3 rounded border border-border-strong bg-elev text-text-base cursor-pointer disabled:opacity-50 disabled:cursor-default"
      >Templates</button>
      <TemplatePickerModal :open="templatesOpen" @close="templatesOpen = false" @pick="onPickTemplate" />
      <button
        type="button"
        @click="onRun"
        :disabled="run.isRunning"
        class="h-9 inline-flex items-center gap-1.5 px-3 rounded font-semibold border border-success bg-success text-[#0a1f0a] cursor-pointer disabled:bg-elev disabled:border-border-strong disabled:text-text-base disabled:cursor-default disabled:opacity-90"
      >
        <span v-if="run.isRunning" class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span>{{ run.isRunning ? 'Running…' : '▶ Run' }}</span>
      </button>
      <button
        type="button"
        @click="onStop"
        :disabled="!run.isRunning"
        class="h-9 inline-flex items-center px-3 rounded border border-border-strong bg-elev text-text-base cursor-pointer disabled:opacity-50 disabled:cursor-default"
      >■ Stop</button>
      <span
        v-if="settings.apiKeyConfigured"
        class="h-9 inline-flex items-center tabular-nums text-xs text-text-dim px-3 rounded border border-border-base bg-elev cursor-pointer select-none"
        :title="settings.credits === null ? 'Click to refresh' : 'OpenRouter credits remaining — click to refresh'"
        @click="settings.refreshCredits()"
        role="button"
      >{{ creditsDisplay }}</span>
      <button
        type="button"
        @click="openSettings"
        title="Settings"
        class="h-9 w-9 inline-flex items-center justify-center rounded border border-border-strong bg-elev text-text-base cursor-pointer text-lg leading-none"
      >⚙</button>
    </div>
  </header>
</template>
