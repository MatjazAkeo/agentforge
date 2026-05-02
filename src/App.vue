<!-- src/App.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useGraphStore } from '@/stores/graph';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useRunStore } from '@/stores/run';
import { pickGraphFileToOpen, pickGraphFileToSave, readGraphFile, writeGraphFile } from '@/persistence/tauri-fs';
import { parseGraph, serializeGraph } from '@/persistence/graph-io';
import { loadApiKey } from '@/secrets/api-key';
import { runGraph } from '@/engine/runner';
import { abortCurrent } from '@/engine/abort';

import Layout from './components/Layout.vue';
import Settings from './components/Settings.vue';
import OnboardingWelcome from './components/OnboardingWelcome.vue';

const graph = useGraphStore();
const settings = useSettingsStore();
const ui = useUiStore();
const run = useRunStore();
const showOnboarding = ref(false);
let unlisten: UnlistenFn | null = null;
let busy = false;

function rafLoop() {
  run.tick();
  requestAnimationFrame(rafLoop);
}

async function bootstrap() {
  try {
    const key = await loadApiKey();
    settings.setApiKey(key);
  } catch (err) {
    console.error('Failed to load API key from keychain:', err);
  }
  showOnboarding.value = !settings.apiKeyConfigured;
}

function confirmDiscardIfDirty(action: string): boolean {
  if (!graph.dirty) return true;
  return confirm(`You have unsaved changes. Discard them and ${action}?`);
}

async function onNew() {
  if (!confirmDiscardIfDirty('start a new graph')) return;
  graph.reset();
}

async function onOpen() {
  if (!confirmDiscardIfDirty('open another graph')) return;
  const path = await pickGraphFileToOpen();
  if (!path) return;
  const text = await readGraphFile(path);
  const g = parseGraph(text);
  graph.load(g, path);
}

async function onSave() {
  if (!graph.filePath) {
    return onSaveAs();
  }
  const text = serializeGraph(graph.graph);
  await writeGraphFile(graph.filePath, text);
  graph.markSaved(graph.filePath);
}

async function onSaveAs() {
  const path = await pickGraphFileToSave(`${graph.graph.name || 'untitled'}.graph.json`);
  if (!path) return;
  const text = serializeGraph(graph.graph);
  await writeGraphFile(path, text);
  graph.markSaved(path);
}

async function onRunFromMenu() {
  if (!settings.apiKeyConfigured) {
    alert('Add an OpenRouter API key in Settings first.');
    return;
  }
  await runGraph({ graph: graph.graph, apiKey: settings.apiKey ?? '' });
}

function onStopFromMenu() { abortCurrent(); }

async function dispatchMenu(payload: string): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    switch (payload) {
      case 'menu.file.new': await onNew(); break;
      case 'menu.file.open': await onOpen(); break;
      case 'menu.file.save': await onSave(); break;
      case 'menu.file.save_as': await onSaveAs(); break;
      case 'menu.run.run': await onRunFromMenu(); break;
      case 'menu.run.stop': onStopFromMenu(); break;
    }
  } catch (err) {
    console.error('Menu handler failed:', payload, err);
    alert(`Action failed: ${(err as Error).message ?? String(err)}`);
  } finally {
    busy = false;
  }
}

onMounted(async () => {
  await bootstrap();
  unlisten = await listen<string>('menu', (e) => { void dispatchMenu(e.payload); });
  requestAnimationFrame(rafLoop);
});

onUnmounted(() => unlisten?.());
</script>

<template>
  <OnboardingWelcome v-if="showOnboarding" @done="showOnboarding = false" />
  <template v-else>
    <Layout />
    <Settings v-if="ui.settingsOpen" />
  </template>
</template>
