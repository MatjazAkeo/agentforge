<script setup lang="ts">
import { computed, ref } from 'vue';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { stat } from '@tauri-apps/plugin-fs';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { copyToAssets, removeAsset, assetExists } from '@/persistence/assets-dir';
import type { FileInputConfig } from '@/domain/node-types';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as FileInputConfig | null);

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['txt', 'json', 'pdf'];

const error = ref<string | null>(null);
const missingFiles = ref<Set<string>>(new Set());

const detailsResult = computed(() => run.current?.nodeResults[props.nodeId]);
const emptyFiles = computed<string[]>(() => {
  const list = (detailsResult.value?.details as { emptyFiles?: string[] } | undefined)?.emptyFiles;
  return Array.isArray(list) ? list : [];
});

async function refreshMissing() {
  if (!cfg.value || !graph.filePath) return;
  const missing = new Set<string>();
  for (const f of cfg.value.files) {
    if (!(await assetExists(graph.filePath, f.filename))) missing.add(f.filename);
  }
  missingFiles.value = missing;
}

async function onAdd() {
  if (!graph.filePath) {
    error.value = 'Save the graph first — file inputs are stored next to the graph file.';
    return;
  }
  error.value = null;

  const picked = await openDialog({
    multiple: true,
    filters: [{ name: 'Files', extensions: ALLOWED }],
  });
  if (!picked) return;
  const paths = Array.isArray(picked) ? picked : [picked];

  const newFiles = [...(cfg.value?.files ?? [])];
  for (const path of paths) {
    let sizeBytes = 0;
    try {
      const info = await stat(path);
      sizeBytes = Number(info.size ?? 0);
    } catch {
      sizeBytes = 0;
    }
    if (sizeBytes > MAX_BYTES) {
      error.value = `${path.split(/[/\\]/).pop()} is over 10 MB — skipped.`;
      continue;
    }
    const finalName = await copyToAssets(graph.filePath, path);
    newFiles.push({ filename: finalName, sizeBytes, sourcePath: path });
  }
  graph.updateNodeConfig(props.nodeId, { files: newFiles });
  await refreshMissing();
}

async function onRemove(idx: number) {
  if (!cfg.value || !graph.filePath) return;
  const f = cfg.value.files[idx];
  if (!confirm(`Remove ${f.filename} from this node and delete the side-car file?`)) return;
  try { await removeAsset(graph.filePath, f.filename); } catch { /* file may already be gone */ }
  const newFiles = cfg.value.files.filter((_, i) => i !== idx);
  graph.updateNodeConfig(props.nodeId, { files: newFiles });
  await refreshMissing();
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

refreshMissing();
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <div class="text-xs opacity-60">
      Reads files from <code class="font-mono">{{ '<graph>' }}.assets/</code> at run time and
      emits their concatenated content wrapped in <code>&lt;file name="…"&gt;</code> blocks.
    </div>

    <ul v-if="cfg.files.length > 0" class="flex flex-col gap-1.5">
      <li
        v-for="(f, idx) in cfg.files"
        :key="f.filename"
        class="flex items-center justify-between gap-2 px-2 py-1.5 bg-elev border border-border-base rounded text-xs"
      >
        <div class="flex flex-col min-w-0 flex-1">
          <span class="font-mono truncate">{{ f.filename }}</span>
          <span class="opacity-60 text-[10px]">{{ fmtSize(f.sizeBytes) }}</span>
          <span
            v-if="missingFiles.has(f.filename)"
            class="text-[10px] text-error"
          >missing on disk</span>
          <span
            v-else-if="emptyFiles.includes(f.filename)"
            class="text-[10px] text-yellow-400"
          >scanned PDF — no text extracted</span>
        </div>
        <button
          type="button"
          class="text-text-dim hover:text-error text-base leading-none px-1"
          @click="onRemove(idx)"
          title="Remove"
        >×</button>
      </li>
    </ul>

    <button
      type="button"
      class="bg-accent/15 text-accent border border-accent rounded px-3 py-1.5 text-xs cursor-pointer hover:bg-accent/25"
      @click="onAdd"
    >Add file…</button>

    <div v-if="error" class="text-error text-[11px]">{{ error }}</div>

    <IOValues :node-id="nodeId" />

    <PortLegend
      :outputs="[
        { id: 'text', type: 'string', description: 'Concatenated XML-wrapped file content.' },
      ]"
    />
  </div>
</template>
