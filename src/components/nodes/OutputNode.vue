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
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
});
const statusColor = computed(() => {
  switch (result.value?.status) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#888';
  }
});
</script>

<template>
  <div
    class="w-[220px] bg-panel-strong border-2 rounded-lg overflow-hidden"
    :style="{ borderColor: statusColor }"
  >
    <div class="px-2.5 py-2 bg-elev border-b border-border-base">
      <strong>Output</strong>
      <div class="opacity-60 text-[10px]">{{ data.config.format }}</div>
    </div>
    <div class="px-2.5 py-2 min-h-[38px] text-[11px] opacity-85">{{ preview }}</div>
    <Handle id="value" type="target" :position="Position.Left" />
  </div>
</template>
