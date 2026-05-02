<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';

const props = defineProps<{ id: string; data: { config: { name: string; valueType: string; defaultValue: unknown } } }>();

const preview = computed(() => {
  const v = props.data.config.defaultValue;
  if (v === undefined || v === null || v === '') return '— empty —';
  if (typeof v === 'string') return v.length > 24 ? `${v.slice(0, 24)}…` : v;
  return String(v);
});
</script>

<template>
  <div class="node-shell w-[240px] bg-[#0f1014] border border-[#2a2a2e] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.35)] font-ui text-text-base">
    <!-- Title bar — emerald for source-of-data nodes -->
    <div class="rounded-t-md bg-[#1d4d2e] px-3 py-1.5 leading-tight">
      <div class="text-[#d4f4dd] font-semibold text-xs">Input</div>
      <div class="text-[#d4f4dd]/65 text-[10px] font-mono">{{ data.config.name }} · {{ data.config.valueType }}</div>
    </div>

    <!-- Single output row: preview text + label + handle on the right edge -->
    <div class="relative h-7 rounded-b-md flex items-center justify-end pr-3 text-[11px]">
      <span class="opacity-60 mr-2 truncate max-w-[140px]">{{ preview }}</span>
      <span class="text-text-dim font-mono text-[10px]">value</span>
      <Handle id="value" type="source" :position="Position.Right" />
    </div>
  </div>
</template>
