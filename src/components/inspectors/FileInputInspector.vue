<script setup lang="ts">
import { computed, ref } from 'vue';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { stat, readFile } from '@tauri-apps/plugin-fs';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { copyToAssets, removeAsset, assetExists, writeOptimizedAsset, readAssetBytes } from '@/persistence/assets-dir';
import { optimizeImage, bytesToBase64 } from '@/files/image';
import type { ImageMime } from '@/domain/images';
import type { FileInputConfig } from '@/domain/node-types';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as FileInputConfig | null);

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp'] as const;
const TEXT_EXTS = ['txt', 'json', 'pdf'] as const;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const TEXT_MAX_BYTES = 10 * 1024 * 1024;

function mimeFromExt(ext: string): ImageMime {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

const error = ref<string | null>(null);
const missingFiles = ref<Set<string>>(new Set());
const thumbCache = ref<Map<string, string>>(new Map());
const previewing = ref<FileInputConfig['files'][number] | null>(null);

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

async function thumbSrcFor(filename: string, mime: ImageMime): Promise<string> {
  const cached = thumbCache.value.get(filename);
  if (cached) return cached;
  if (!graph.filePath) return '';
  try {
    const bytes = await readAssetBytes(graph.filePath, filename);
    const dataUrl = `data:${mime};base64,${bytesToBase64(new Uint8Array(bytes))}`;
    thumbCache.value.set(filename, dataUrl);
    return dataUrl;
  } catch {
    return '';
  }
}

async function ensureThumb(filename: string, mime: ImageMime) {
  if (thumbCache.value.has(filename)) return;
  await thumbSrcFor(filename, mime);
}

function openPreview(f: FileInputConfig['files'][number]) {
  previewing.value = f;
}

async function onAdd() {
  if (!graph.filePath) {
    error.value = 'Save the graph first — file inputs are stored next to the graph file.';
    return;
  }
  error.value = null;
  const picked = await openDialog({
    multiple: true,
    filters: [{ name: 'Files', extensions: [...TEXT_EXTS, ...IMAGE_EXTS] }],
  });
  if (!picked) return;
  const paths = Array.isArray(picked) ? picked : [picked];

  const newFiles = [...(cfg.value?.files ?? [])];
  for (const path of paths) {
    const basename = path.split(/[/\\]/).pop()!;
    const ext = (basename.split('.').pop() ?? '').toLowerCase();
    const isImage = (IMAGE_EXTS as readonly string[]).includes(ext);
    const isText = (TEXT_EXTS as readonly string[]).includes(ext);
    if (!isImage && !isText) {
      error.value = `${basename}: only ${[...TEXT_EXTS, ...IMAGE_EXTS].join(' / ')} supported.`;
      continue;
    }

    let rawSize = 0;
    try { const info = await stat(path); rawSize = Number(info.size ?? 0); } catch { rawSize = 0; }
    const cap = isImage ? IMAGE_MAX_BYTES : TEXT_MAX_BYTES;
    if (rawSize > cap) {
      const capMb = (cap / 1024 / 1024).toFixed(0);
      error.value = `${basename} is over ${capMb} MB — skipped.`;
      continue;
    }

    if (isImage) {
      const raw = await readFile(path);
      const optimized = await optimizeImage(new Uint8Array(raw), mimeFromExt(ext));
      const finalName = await writeOptimizedAsset(graph.filePath, basename, optimized.bytes, optimized.mime);
      newFiles.push({
        filename: finalName,
        sizeBytes: optimized.newSizeBytes,
        sourcePath: path,
        kind: 'image',
        mime: optimized.mime,
      });
    } else {
      const finalName = await copyToAssets(graph.filePath, path);
      newFiles.push({ filename: finalName, sizeBytes: rawSize, sourcePath: path, kind: 'text' });
    }
  }

  graph.updateNodeConfig(props.nodeId, { files: newFiles });
  await refreshMissing();
}

async function onRemove(idx: number) {
  if (!cfg.value || !graph.filePath) return;
  const f = cfg.value.files[idx];
  if (!confirm(`Remove ${f.filename} from this node and delete the side-car file?`)) return;
  try { await removeAsset(graph.filePath, f.filename); } catch { /* file may already be gone */ }
  if (f.kind === 'image') thumbCache.value.delete(f.filename);
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

    <!-- Preview modal -->
    <div
      v-if="previewing"
      class="fixed inset-0 z-[2000] bg-black/70 flex items-center justify-center"
      @click.self="previewing = null"
    >
      <div class="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-2">
        <img :src="thumbCache.get(previewing.filename)" :alt="previewing.filename" class="max-w-full max-h-[80vh] object-contain" />
        <button type="button" class="text-text-base bg-elev border border-border-base rounded px-3 py-1 text-xs" @click="previewing = null">Close</button>
      </div>
    </div>

    <ul v-if="cfg.files.length > 0" class="flex flex-col gap-1.5">
      <li
        v-for="(f, idx) in cfg.files"
        :key="f.filename"
        class="flex items-center gap-2 px-2 py-1.5 bg-elev border border-border-base rounded text-xs"
      >
        <template v-if="f.kind === 'image'">
          <img
            v-if="thumbCache.get(f.filename)"
            :src="thumbCache.get(f.filename)"
            class="w-12 h-12 object-cover rounded border border-border-base flex-shrink-0 cursor-pointer"
            :alt="f.filename"
            @click="openPreview(f)"
          />
          <div
            v-else
            class="w-12 h-12 rounded border border-border-base flex-shrink-0 bg-node-inset flex items-center justify-center text-text-dim text-[9px]"
            @vue:mounted="ensureThumb(f.filename, f.mime!)"
          >loading…</div>
        </template>

        <div class="flex flex-col min-w-0 flex-1">
          <span class="font-mono truncate">{{ f.filename }}</span>
          <span class="opacity-60 text-[10px]">{{ fmtSize(f.sizeBytes) }}</span>
          <span v-if="missingFiles.has(f.filename)" class="text-[10px] text-error">missing on disk</span>
          <span v-else-if="emptyFiles.includes(f.filename)" class="text-[10px] text-yellow-400">scanned PDF — no text extracted</span>
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
        { id: 'images', type: 'images', description: 'Array of ImageRef assets (when image files are configured).' },
      ]"
    />
  </div>
</template>
