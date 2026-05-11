<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed, ref } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';
import { readAssetBytes } from '@/persistence/assets-dir';
import { bytesToBase64 } from '@/files/image';
import type { FileInputConfig } from '@/domain/node-types';
import type { ImageMime } from '@/domain/images';

const props = defineProps<{ id: string; data: { config: FileInputConfig } }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');

const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return 'var(--border)';
  }
});

const files = computed(() => props.data.config.files ?? []);
const fileCount = computed(() => files.value.length);
const hasImages = computed(() => files.value.some((f) => f.kind === 'image'));
// Show the text port when there's something text-shaped to emit: empty config
// (legacy compat, default to 'text') OR at least one text-kind file attached.
const hasText = computed(() => files.value.length === 0 || files.value.some((f) => (f.kind ?? 'text') === 'text'));

// Thumbnail cache for image entries on the node card. Keyed by filename,
// resolved on the file row's first mount and reused on subsequent renders.
const thumbCache = ref<Map<string, string>>(new Map());

async function ensureThumb(filename: string, mime: ImageMime | undefined) {
  if (thumbCache.value.has(filename)) return;
  if (!graph.filePath || !mime) return;
  try {
    const bytes = await readAssetBytes(graph.filePath, filename);
    const dataUrl = `data:${mime};base64,${bytesToBase64(new Uint8Array(bytes))}`;
    thumbCache.value.set(filename, dataUrl);
  } catch {
    /* leave unset — placeholder stays */
  }
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function onDelete() {
  graph.removeNode(props.id);
}
</script>

<template>
  <div
    class="node-shell group w-[240px] bg-node border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-border-base">
      <span class="w-2 h-2 rounded-full bg-[#5cd97a] flex-shrink-0" title="source" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">File Input</div>
        <div class="text-text-dim text-[10px] font-mono truncate">file-input</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <div v-if="hasText" class="relative h-7 flex items-center justify-end pr-3 text-[11px]">
      <span class="text-text-dim font-mono text-[10px]">text</span>
      <Handle id="text" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
    </div>

    <div v-if="hasImages" class="relative h-7 flex items-center justify-end pr-3 text-[11px]">
      <span class="text-text-dim font-mono text-[10px]">images</span>
      <Handle id="images" type="source" :position="Position.Right" :style="{ background: colorForType('images') }" />
    </div>

    <div class="rounded-b-md border-t border-border-base bg-node-inset">
      <div v-if="fileCount === 0" class="px-3 py-2 text-[11px] italic opacity-55 text-center">
        — no files —
      </div>
      <ul v-else class="flex flex-col gap-1.5 px-2 py-2 list-none m-0">
        <li
          v-for="f in files"
          :key="f.filename"
          class="flex items-center gap-2"
        >
          <img
            v-if="f.kind === 'image' && thumbCache.get(f.filename)"
            :src="thumbCache.get(f.filename)"
            class="w-9 h-9 object-cover rounded border border-border-base flex-shrink-0"
            :alt="f.filename"
          />
          <div
            v-else-if="f.kind === 'image'"
            class="w-9 h-9 rounded border border-border-base flex-shrink-0 bg-node"
            @vue:mounted="ensureThumb(f.filename, f.mime)"
          />
          <div
            v-else
            class="w-9 h-9 rounded border border-border-base flex-shrink-0 bg-node flex items-center justify-center text-text-dim font-mono text-[9px] uppercase"
            :title="f.filename"
          >{{ (f.filename.split('.').pop() ?? '').slice(0, 4) }}</div>

          <div class="flex-1 min-w-0">
            <div class="font-mono text-[10px] truncate" :title="f.filename">{{ f.filename }}</div>
            <div class="opacity-60 text-[9px]">{{ fmtSize(f.sizeBytes) }}</div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
