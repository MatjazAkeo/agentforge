<script setup lang="ts">
import { computed, ref } from 'vue';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { stat } from '@tauri-apps/plugin-fs';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { copyToAssets, removeAsset, readAssetBytes, assetsDirFor } from '@/persistence/assets-dir';
import { writeFileAtomic } from '@/persistence/atomic-write';
import { dbRegistry } from '@/sqlite/db-registry';
import type { ToolPackConfig } from '@/domain/node-types';

const props = defineProps<{ nodeId: string }>();
const emit = defineEmits<{ schemaReloaded: [] }>();
const graph = useGraphStore();
const run = useRunStore();

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = ['db', 'sqlite', 'sqlite3'];

const error = ref<string | null>(null);
const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ToolPackConfig | null);
const conn = computed(() => cfg.value?.connection as { db?: string; sourcePath?: string; sizeBytes?: number } | null);
const filename = computed(() => conn.value?.db ?? '');
const sizeBytes = computed(() => conn.value?.sizeBytes ?? 0);
const isRunning = computed(() => run.isRunning);

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function onChoose() {
  if (!graph.filePath) {
    error.value = 'Save the graph first — Tool Pack needs a saved location to find its side-car .db.';
    return;
  }
  error.value = null;
  const picked = await openDialog({ multiple: false, filters: [{ name: 'SQLite databases', extensions: ALLOWED }] });
  if (!picked || Array.isArray(picked)) return;

  let size = 0;
  try { const info = await stat(picked); size = Number(info.size ?? 0); } catch { /* leave 0 */ }
  if (size > MAX_BYTES) {
    error.value = `${picked.split(/[/\\]/).pop()} is over 100 MB — Tool Pack rejects DBs larger than that.`;
    return;
  }

  const oldFilename = filename.value;
  if (oldFilename && graph.filePath) {
    try { await removeAsset(graph.filePath, oldFilename); } catch { /* may already be gone */ }
  }
  const finalName = await copyToAssets(graph.filePath, picked);
  graph.updateNodeConfig(props.nodeId, {
    connection: { db: finalName, sourcePath: picked, sizeBytes: size },
  });

  // (Re-)init the host with the new bytes.
  const host = dbRegistry.getOrCreate(props.nodeId);
  const bytes = await readAssetBytes(graph.filePath, finalName);
  await host.init(bytes);
  emit('schemaReloaded');
}

async function onReloadSchema() {
  emit('schemaReloaded');
}

async function onReloadFromDisk() {
  if (!graph.filePath || !filename.value) return;
  const host = dbRegistry.getOrCreate(props.nodeId);
  const bytes = await readAssetBytes(graph.filePath, filename.value);
  await host.reload(bytes);
  emit('schemaReloaded');
}

async function onSaveNow() {
  if (!graph.filePath || !filename.value) return;
  const host = dbRegistry.get(props.nodeId);
  if (!host) return;
  const bytes = await host.export();
  const dbPath = `${assetsDirFor(graph.filePath)}/${filename.value}`;
  await writeFileAtomic(dbPath, new Uint8Array(bytes));
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2">
    <div class="text-xs opacity-60">SQLite database</div>
    <div v-if="filename" class="flex items-center gap-2 px-2 py-1.5 bg-elev border border-border-base rounded text-xs">
      <span class="font-mono truncate flex-1">{{ filename }}</span>
      <span class="opacity-60 text-[10px]">{{ fmtSize(sizeBytes) }}</span>
    </div>
    <div v-else class="text-text-dim italic text-xs px-2 py-1.5">— no database attached —</div>

    <div class="flex flex-wrap gap-1.5">
      <button type="button" class="bg-accent/15 text-accent border border-accent rounded px-2.5 py-1 text-[11px] cursor-pointer hover:bg-accent/25" @click="onChoose">
        {{ filename ? 'Replace database…' : 'Choose database…' }}
      </button>
      <button type="button" :disabled="!filename" class="bg-elev border border-border-base rounded px-2.5 py-1 text-[11px] cursor-pointer disabled:opacity-50" @click="onReloadSchema">Reload schema</button>
      <button type="button" :disabled="!filename" class="bg-elev border border-border-base rounded px-2.5 py-1 text-[11px] cursor-pointer disabled:opacity-50" @click="onReloadFromDisk">Reload from disk</button>
      <button type="button" :disabled="!filename || isRunning" class="bg-elev border border-border-base rounded px-2.5 py-1 text-[11px] cursor-pointer disabled:opacity-50" @click="onSaveNow" :title="isRunning ? 'Wait for the current run to finish' : 'Save in-memory changes to disk'">Save changes now</button>
    </div>

    <div v-if="error" class="text-error text-[11px]">{{ error }}</div>
  </div>
</template>
