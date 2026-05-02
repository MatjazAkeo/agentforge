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
  <div class="w-[220px] bg-panel-strong border-2 border-[#888] rounded-lg overflow-hidden">
    <div class="px-2.5 py-2 bg-elev border-b border-border-base">
      <strong>Input</strong>
      <div class="opacity-60 text-[10px]">{{ data.config.name }} · {{ data.config.valueType }}</div>
    </div>
    <div class="px-2.5 py-2 min-h-[38px] text-[11px]">
      <div class="opacity-85">{{ preview }}</div>
    </div>
    <Handle id="value" type="source" :position="Position.Right" />
  </div>
</template>
