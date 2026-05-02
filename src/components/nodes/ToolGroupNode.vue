<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';

const props = defineProps<{ id: string; data: { config: { label: string } } }>();
const graph = useGraphStore();
const run = useRunStore();

const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');

const memberCount = computed(
  () =>
    graph.edges.filter(
      (e) => e.target === props.id && (e.targetHandle ?? '') === 'tools',
    ).length,
);

function onDelete() {
  graph.removeNode(props.id);
}
</script>

<template>
  <div
    class="node-shell group w-[240px] bg-[#25272d] border border-[#16181c] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#ffd54a] flex-shrink-0" title="tool group" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Tool Group</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ data.config.label || '— unnamed —' }}</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <!-- Single input row + single output row -->
    <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
      <span class="text-text-dim font-mono text-[10px]">tools</span>
      <Handle id="tools" type="target" :position="Position.Left" :style="{ background: colorForType('tools') }" />
      <span class="text-text-dim font-mono text-[10px]">def</span>
      <Handle id="toolDefinition" type="source" :position="Position.Right" :style="{ background: colorForType('tools') }" />
    </div>

    <div class="rounded-b-md px-3 py-1.5 text-[10px] opacity-60 border-t border-[#16181c] bg-[#16181c] text-center">
      <span v-if="memberCount > 0">{{ memberCount }} tool{{ memberCount === 1 ? '' : 's' }}</span>
      <span v-else class="italic">— no tools yet —</span>
    </div>
  </div>
</template>
