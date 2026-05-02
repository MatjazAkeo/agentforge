<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useRunStore } from '@/stores/run';
import { useGraphStore } from '@/stores/graph';
import { colorForType } from '@/nodes/port-types';

const props = defineProps<{ id: string; data: { config: { format: string } } }>();
const run = useRunStore();
const graph = useGraphStore();

const result = computed(() => run.current?.nodeResults[props.id]);

const hasValue = computed(() => {
  const v = result.value?.details?.value;
  return v !== undefined && v !== null;
});

const preview = computed(() => {
  if (!hasValue.value) return '— not yet run —';
  const v = result.value?.details?.value;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
});

const borderColor = computed(() => {
  switch (result.value?.status) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});

function onDelete() {
  graph.removeNode(props.id);
}
</script>

<template>
  <div
    class="node-shell group w-[240px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="result?.status ?? 'idle'"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#ff7676] flex-shrink-0" title="sink" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Output</div>
        <div class="text-text-dim text-[10px] font-mono truncate">format · {{ data.config.format }}</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <div class="relative h-7 flex items-center pl-3 text-[11px]">
      <Handle id="text" type="target" :position="Position.Left" :style="{ background: colorForType('string') }" />
      <span class="text-text-dim font-mono text-[10px]">text</span>
    </div>

    <div
      :class="[
        'rounded-b-md px-3 py-2 text-[11px] border-t border-[#16181c] bg-[#16181c] min-h-[34px] whitespace-pre-wrap break-words',
        hasValue ? 'text-left opacity-90' : 'text-center italic opacity-55',
      ]"
    >
      {{ preview }}
    </div>
  </div>
</template>
