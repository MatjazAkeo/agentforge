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
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});

const callCount = computed(() => {
  const results = run.current?.nodeResults[props.id]?.details?.results as Array<unknown> | undefined;
  return results?.length ?? 0;
});

function onDelete() {
  graph.removeNode(props.id);
}
</script>

<template>
  <div
    class="node-shell group w-[260px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#ff5577] flex-shrink-0" title="tool runner" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Tool Runner</div>
        <div class="text-text-dim text-[10px] font-mono truncate">executes tool calls</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <!-- Paired port rows: input on left, output on right of the same row.
         Inputs ordered tools, messages, toolCalls top-to-bottom. -->
    <div class="py-1">
      <!-- Row 1: tools in | messages out -->
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">tools</span>
        <Handle id="tools" type="target" :position="Position.Left" :style="{ background: colorForType('tools') }" />
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="source" :position="Position.Right" :style="{ background: colorForType('messages') }" />
      </div>
      <!-- Row 2: messages in | results out -->
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="target" :position="Position.Left" :style="{ background: colorForType('messages') }" />
        <span class="text-text-dim font-mono text-[10px]">results</span>
        <Handle id="results" type="source" :position="Position.Right" :style="{ background: colorForType('json') }" />
      </div>
      <!-- Row 3: toolCalls in | (empty) -->
      <div class="relative h-6 flex items-center px-3 text-[11px]">
        <Handle id="toolCalls" type="target" :position="Position.Left" :style="{ background: colorForType('tool-calls') }" />
        <span class="text-text-dim font-mono text-[10px]">toolCalls</span>
      </div>
    </div>

    <div class="rounded-b-md px-3 py-1.5 text-[10px] opacity-60 border-t border-[#16181c] bg-[#16181c] text-center">
      <span v-if="callCount > 0">{{ callCount }} call{{ callCount === 1 ? '' : 's' }} last run</span>
      <span v-else class="italic">— no calls yet —</span>
    </div>
  </div>
</template>
