<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';

const props = defineProps<{ id: string }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running': case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});
function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div
    class="node-shell group w-[220px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#b388ff] flex-shrink-0" title="chat input" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Chat Input</div>
        <div class="text-text-dim text-[10px] font-mono truncate">from sidebar</div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>
    <div class="py-1">
      <div class="relative h-6 flex items-center justify-end pr-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">userMessage</span>
        <Handle id="userMessage" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
      </div>
      <div class="relative h-6 flex items-center justify-end pr-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="source" :position="Position.Right" :style="{ background: colorForType('messages') }" />
      </div>
    </div>
  </div>
</template>
