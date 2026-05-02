<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';

const props = defineProps<{ id: string; data: { config: { name: string; valueType: string; defaultValue: unknown } } }>();
const graph = useGraphStore();

const preview = computed(() => {
  const v = props.data.config.defaultValue;
  if (v === undefined || v === null || v === '') return '— empty —';
  if (typeof v === 'string') return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  return String(v);
});

function onDelete() {
  graph.removeNode(props.id);
}
</script>

<template>
  <div class="node-shell group w-[240px] bg-[#25272d] border border-[#16181c] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base">
    <!-- Title bar -->
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#4ad7e2] flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Input</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ data.config.name }} · {{ data.config.valueType }}</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <!-- Port row: empty left | value (out) right -->
    <div class="relative h-7 flex items-center justify-end pr-3 text-[11px]">
      <span class="text-text-dim font-mono text-[10px]">value</span>
      <Handle id="value" type="source" :position="Position.Right" />
    </div>

    <!-- Default-value preview, left-aligned -->
    <div class="rounded-b-md px-3 py-2 text-[11px] opacity-90 border-t border-[#16181c] bg-[#16181c] min-h-[34px] text-left">
      {{ preview }}
    </div>
  </div>
</template>
