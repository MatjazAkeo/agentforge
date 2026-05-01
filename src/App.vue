<!-- src/App.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useGraphStore } from '@/stores/graph';
import { pickGraphFileToOpen, pickGraphFileToSave, readGraphFile, writeGraphFile } from '@/persistence/tauri-fs';
import { parseGraph, serializeGraph } from '@/persistence/graph-io';
import Layout from './components/Layout.vue';

const graph = useGraphStore();
let unlisten: UnlistenFn | null = null;
let busy = false;

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

async function dispatchMenu(payload: string): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    switch (payload) {
      case 'menu.file.new': await onNew(); break;
      case 'menu.file.open': await onOpen(); break;
      case 'menu.file.save': await onSave(); break;
      case 'menu.file.save_as': await onSaveAs(); break;
    }
  } catch (err) {
    console.error('Menu handler failed:', payload, err);
    alert(`Action failed: ${(err as Error).message ?? String(err)}`);
  } finally {
    busy = false;
  }
}

onMounted(async () => {
  unlisten = await listen<string>('menu', (e) => { void dispatchMenu(e.payload); });
});

onUnmounted(() => { unlisten?.(); });
</script>

<template>
  <Layout />
</template>
