<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';

const props = defineProps<{ id: string; data: { config: { name: string; valueType: string; defaultValue: unknown } } }>();

const preview = computed(() => {
  const v = props.data.config.defaultValue;
  if (v === undefined || v === null || v === '') return '— empty —';
  if (typeof v === 'string') return v.length > 30 ? `${v.slice(0, 30)}…` : v;
  return String(v);
});
</script>

<template>
  <div class="node-card input-card">
    <div class="header">
      <strong>Input</strong>
      <div class="sub">{{ data.config.name }} · {{ data.config.valueType }}</div>
    </div>
    <div class="body">
      <div class="preview">{{ preview }}</div>
    </div>
    <Handle id="value" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.node-card { width: 220px; background: var(--bg-panel-strong); border: 2px solid #888; border-radius: 8px; overflow: hidden; }
.header { padding: 8px 10px; background: var(--bg-elev); border-bottom: 1px solid var(--border); }
.sub { opacity: 0.6; font-size: 10px; }
.body { padding: 8px 10px; min-height: 38px; font-size: 11px; }
.preview { opacity: 0.85; }
</style>
