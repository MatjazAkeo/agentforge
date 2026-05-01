<!-- src/components/Toolbar.vue -->
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
    await runGraph({ graph: graph.graph, apiKey: settings.apiKey ?? '' });
  } catch (err) {
    console.error('Run failed:', err);
  }
}
function onStop() { abortCurrent(); }
</script>

<template>
  <header class="toolbar">
    <div class="left">
      <strong>{{ displayName }}</strong>
      <span v-if="graph.dirty" class="dirty-dot" title="Unsaved changes">●</span>
    </div>
    <div class="stats" v-if="run.current">
      <span class="stat">in: <strong>{{ run.totalTokensIn }}</strong></span>
      <span class="stat">out: <strong>{{ run.totalTokensOut }}</strong></span>
      <span class="stat">⏱ <strong>{{ elapsedDisplay }}</strong></span>
    </div>
    <div class="right">
      <button class="btn btn-run" @click="onRun" :disabled="run.isRunning">▶ Run</button>
      <button class="btn" @click="onStop" :disabled="!run.isRunning">■ Stop</button>
      <button class="btn btn-icon" @click="openSettings" title="Settings">⚙</button>
    </div>
  </header>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--bg-panel); border-bottom: 1px solid var(--border); }
.left { display: flex; align-items: center; gap: 4px; }
.stats { display: flex; gap: 12px; opacity: 0.85; font-size: 12px; }
.stat { font-variant-numeric: tabular-nums; }
.right { margin-left: auto; display: flex; gap: 6px; }
.btn { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border-strong); border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-run { background: var(--success); border-color: var(--success); color: #0a1f0a; font-weight: 600; }
.btn-run:disabled { background: var(--bg-elev); color: var(--text); }
.btn-icon { padding: 4px 8px; }
.dirty-dot { color: var(--accent); margin-left: 4px; }
</style>
