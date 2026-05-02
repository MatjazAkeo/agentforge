<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useRunStore } from '@/stores/run';
import { useGraphStore } from '@/stores/graph';

const props = defineProps<{ id: string; data: { config: { model: string } } }>();
const run = useRunStore();
const graph = useGraphStore();

const result = computed(() => run.current?.nodeResults[props.id]);
const livePreview = computed(() => run.livePreviews[props.id]);

const status = computed(() => result.value?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});
const tokens = computed(() => {
  const u = result.value?.details?.usage as { input: number; output: number } | undefined;
  return u ? u.input + u.output : null;
});
const previewText = computed(() => {
  if (livePreview.value) return livePreview.value;
  const v = result.value?.details?.response as { text?: string } | undefined;
  if (v?.text) return v.text.length > 200 ? `${v.text.slice(0, 200)}…` : v.text;
  if (status.value === 'error') return result.value?.errorMessage ?? 'error';
  return '— not yet run —';
});

function onDelete() {
  graph.removeNode(props.id);
}
</script>

<template>
  <div
    class="node-shell group w-[260px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
  >
    <!-- Title bar -->
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#b388ff] flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <div class="text-text-base font-medium text-xs leading-tight">LLM Call</div>
          <span
            v-if="tokens !== null"
            class="text-[10px] bg-black/40 text-white/85 px-1.5 py-px rounded-sm font-mono"
          >{{ tokens }} tok</span>
        </div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ data.config.model }}</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <!-- Paired port rows: input on left, output on right of the same row -->
    <div class="py-1">
      <!-- Row 1: messages in | text out -->
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="target" :position="Position.Left" />
        <span class="text-text-dim font-mono text-[10px]">text</span>
        <Handle id="text" type="source" :position="Position.Right" />
      </div>
      <!-- Row 2: userMessage in | messages out -->
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">userMessage</span>
        <Handle id="userMessage" type="target" :position="Position.Left" />
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="source" :position="Position.Right" />
      </div>
      <!-- Row 3: tools in | (empty right) -->
      <div class="relative h-6 flex items-center px-3 text-[11px]">
        <Handle id="tools" type="target" :position="Position.Left" />
        <span class="text-text-dim font-mono text-[10px]">tools</span>
      </div>
    </div>

    <!-- Live / final preview -->
    <div class="rounded-b-md px-3 py-2 text-[11px] opacity-90 border-t border-[#16181c] bg-[#16181c] min-h-[36px] whitespace-pre-wrap break-words">
      {{ previewText }}
    </div>
  </div>
</template>
