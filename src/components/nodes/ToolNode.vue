<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { useGraphStore } from '@/stores/graph';
import { colorForType } from '@/nodes/port-types';

const props = defineProps<{ id: string; data: { config: { name: string; description: string } } }>();
const graph = useGraphStore();

function onDelete() {
  graph.removeNode(props.id);
}
</script>

<template>
  <div class="node-shell group w-[240px] bg-node border border-border-base rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base">
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-border-base">
      <span class="w-2 h-2 rounded-full bg-[#ffd54a] flex-shrink-0" title="tool definition" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Tool</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ data.config.name }}</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <!-- Description (truncated, left) + output pin (right) on the same row -->
    <div class="relative h-7 rounded-b-md flex items-center gap-2 pl-3 pr-3 text-[11px]">
      <span
        :title="data.config.description"
        class="flex-1 min-w-0 opacity-60 truncate text-left"
      >{{ data.config.description }}</span>
      <span class="text-text-dim font-mono text-[10px] flex-shrink-0">def</span>
      <Handle id="toolDefinition" type="source" :position="Position.Right" :style="{ background: colorForType('tools') }" />
    </div>
  </div>
</template>
