<!-- src/App.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
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
import { TEMPLATES } from '@/templates';

import Layout from './components/Layout.vue';
import Settings from './components/Settings.vue';
import OnboardingWelcome from './components/OnboardingWelcome.vue';
import TrustPromptModal from './components/TrustPromptModal.vue';
import UpdateBanner from './components/UpdateBanner.vue';

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

function applyTheme(pref: 'system' | 'light' | 'dark') {
  // 'system' resolves to whatever the OS preference is right now. The
  // <html data-theme> attribute drives the legacy CSS variables in tokens.css.
  const resolved =
    pref === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : pref;
  document.documentElement.setAttribute('data-theme', resolved);
}

async function bootstrap() {
  // Apply the persisted theme before paint so there's no light→dark flash.
  applyTheme(settings.theme);

  try {
    const key = await loadApiKey();
    settings.setApiKey(key);
  } catch (err) {
    console.error('Failed to load API key from keychain:', err);
  }
  showOnboarding.value = !settings.apiKeyConfigured;

  // Auto-load the "Hello Model" template by default for a never-empty canvas
  // — unless the user has disabled this in General settings.
  if (settings.autoLoadHelloModel) {
    const helloTemplate = TEMPLATES.find((t) => t.id === 'hello-model');
    if (helloTemplate) {
      graph.load(JSON.parse(JSON.stringify(helloTemplate.graph)), null);
    }
  }
}

// Re-apply theme whenever the setting changes (e.g. user toggles in Settings).
watch(() => settings.theme, applyTheme);
// Also re-apply if the OS preference flips while pref is 'system'.
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (settings.theme === 'system') applyTheme('system');
  });
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
  if (g.containsCustomCode) {
    const decision = await ui.askForTrust(path);
    if (decision === 'reject') return;
  }
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
    <TrustPromptModal />
    <UpdateBanner />
  </template>
</template>
