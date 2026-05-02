<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { runGraph } from '@/engine/runner';
import { abortCurrent } from '@/engine/abort';

const graph = useGraphStore();
const run = useRunStore();
const ui = useUiStore();
const settings = useSettingsStore();

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
    </div>
    <div class="ml-auto flex gap-1.5">
      <button
        type="button"
        @click="onRun"
        :disabled="run.isRunning"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold border border-success bg-success text-[#0a1f0a] cursor-pointer disabled:bg-elev disabled:border-border-strong disabled:text-text-base disabled:cursor-default disabled:opacity-90"
      >
        <span v-if="run.isRunning" class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span>{{ run.isRunning ? 'Running…' : '▶ Run' }}</span>
      </button>
      <button
        type="button"
        @click="onStop"
        :disabled="!run.isRunning"
        class="px-3 py-1.5 rounded border border-border-strong bg-elev text-text-base cursor-pointer disabled:opacity-50 disabled:cursor-default"
      >■ Stop</button>
      <button
        type="button"
        @click="openSettings"
        title="Settings"
        class="px-2.5 py-1 rounded border border-border-strong bg-elev text-text-base cursor-pointer text-lg leading-none"
      >⚙</button>
    </div>
  </header>
</template>
