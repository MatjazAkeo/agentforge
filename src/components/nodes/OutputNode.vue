<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useRunStore } from '@/stores/run';

const props = defineProps<{ id: string; data: { config: { format: string } } }>();
const run = useRunStore();

const result = computed(() => run.current?.nodeResults[props.id]);
const preview = computed(() => {
  const v = result.value?.details?.value;
  if (v === undefined || v === null) return '— not yet run —';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 100 ? `${s.slice(0, 100)}…` : s;
});
const borderColor = computed(() => {
  switch (result.value?.status) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#2a2a2e';
  }
});
</script>

<template>
  <div
    class="node-shell w-[240px] bg-[#0f1014] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.35)] font-ui text-text-base"
    :style="{ borderColor }"
  >
    <!-- Title bar — rose for sink-of-data nodes -->
    <div class="rounded-t-md bg-[#4d1d1d] px-3 py-1.5 leading-tight">
      <div class="text-[#f4d4d4] font-semibold text-xs">Output</div>
      <div class="text-[#f4d4d4]/65 text-[10px] font-mono">format · {{ data.config.format }}</div>
    </div>

    <!-- Input row: handle on left, label after -->
    <div class="relative h-7 flex items-center pl-3 text-[11px]">
      <Handle id="value" type="target" :position="Position.Left" />
      <span class="text-text-dim font-mono text-[10px]">value</span>
    </div>

    <!-- Result preview -->
    <div class="rounded-b-md px-3 py-2 text-[11px] opacity-85 border-t border-[#1f1f23] bg-[#0a0b0e] min-h-[34px]">
      {{ preview }}
    </div>
  </div>
</template>
