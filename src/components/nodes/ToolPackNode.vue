<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';
import type { ToolPackConfig } from '@/domain/node-types';

const props = defineProps<{ id: string; data: { config: ToolPackConfig } }>();
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

const toolCount = computed(() => props.data.config.tools?.length ?? 0);
const dbName = computed(() => {
  const c = props.data.config.connection as { db?: string } | undefined;
  return c?.db || '— no DB —';
});
const flavor = computed(() => props.data.config.flavor ?? 'sqlite');

function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div
    class="node-shell group w-[260px] bg-node border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-border-base">
      <span class="w-2 h-2 rounded-full bg-[#ffd54a] flex-shrink-0" title="tool pack" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Tool Pack</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ flavor }} · {{ dbName }}</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <div class="relative h-7 flex items-center justify-end pr-3 text-[11px]">
      <span class="text-text-dim font-mono text-[10px]">tools</span>
      <Handle id="tools" type="source" :position="Position.Right" :style="{ background: colorForType('tools') }" />
    </div>

    <div
      :class="[
        'rounded-b-md px-3 py-2 text-[11px] border-t border-border-base bg-node-inset min-h-[34px] text-center',
        toolCount === 0 ? 'italic opacity-55' : 'opacity-90',
      ]"
    >
      <span v-if="toolCount === 0">— no tools —</span>
      <span v-else>{{ toolCount }} {{ toolCount === 1 ? 'tool' : 'tools' }}</span>
    </div>
  </div>
</template>
