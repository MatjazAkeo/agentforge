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
  <div class="node-card output-card" :style="{ borderColor: statusColor }">
    <div class="header">
      <strong>Output</strong>
      <div class="sub">{{ data.config.format }}</div>
    </div>
    <div class="body">{{ preview }}</div>
    <Handle id="value" type="target" :position="Position.Left" />
  </div>
</template>

<style scoped>
.node-card { width: 220px; background: var(--bg-panel-strong); border: 2px solid #888; border-radius: 8px; overflow: hidden; }
.header { padding: 8px 10px; background: var(--bg-elev); border-bottom: 1px solid var(--border); }
.sub { opacity: 0.6; font-size: 10px; }
.body { padding: 8px 10px; min-height: 38px; font-size: 11px; opacity: 0.85; }
</style>
