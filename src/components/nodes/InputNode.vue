<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';

const props = defineProps<{ id: string; data: { config: { name: string; defaultValue: string } } }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');

const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});

const isEmpty = computed(() => {
  const v = props.data.config.defaultValue;
  return v === undefined || v === null || v === '';
});

const preview = computed(() => {
  if (isEmpty.value) return '— empty —';
  const v = props.data.config.defaultValue;
  return v.length > 80 ? `${v.slice(0, 80)}…` : v;
});

function onDelete() {
  graph.removeNode(props.id);
}
</script>

<template>
  <div
    class="node-shell group w-[240px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#5cd97a] flex-shrink-0" title="source" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Input</div>
        <div class="text-text-dim text-[10px] font-mono truncate">Input · text</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <div class="relative h-7 flex items-center justify-end pr-3 text-[11px]">
      <span class="text-text-dim font-mono text-[10px]">text</span>
      <Handle id="text" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
    </div>

    <div
      :class="[
        'rounded-b-md px-3 py-2 text-[11px] border-t border-[#16181c] bg-[#16181c] min-h-[34px] whitespace-pre-wrap break-words',
        isEmpty ? 'text-center italic opacity-55' : 'text-left opacity-90',
      ]"
    >
      {{ preview }}
    </div>
  </div>
</template>
