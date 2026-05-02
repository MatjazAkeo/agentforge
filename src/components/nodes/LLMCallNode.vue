<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useRunStore } from '@/stores/run';

const props = defineProps<{ id: string; data: { config: { model: string } } }>();
const run = useRunStore();

const result = computed(() => run.current?.nodeResults[props.id]);
const livePreview = computed(() => run.livePreviews[props.id]);

const status = computed(() => result.value?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#888';
  }
});
const tokens = computed(() => {
  const u = result.value?.details?.usage as { input: number; output: number } | undefined;
  return u ? u.input + u.output : null;
});
const previewText = computed(() => {
  if (livePreview.value) return livePreview.value;
  const v = result.value?.details?.response as { text?: string } | undefined;
  if (v?.text) return v.text.length > 80 ? `${v.text.slice(0, 80)}…` : v.text;
  if (status.value === 'error') return result.value?.errorMessage ?? 'error';
  return '— not yet run —';
});
</script>

<template>
  <div
    class="w-[220px] bg-panel-strong border-2 rounded-lg overflow-hidden"
    :style="{ borderColor }"
  >
    <div class="relative px-2.5 py-2 bg-elev border-b border-border-base flex flex-col gap-0.5">
      <strong>LLM Call</strong>
      <div class="opacity-60 text-[10px]">{{ data.config.model }}</div>
      <span
        v-if="tokens !== null"
        class="absolute right-2 top-2 text-[9px] bg-[#1f3d1f] text-[#8fd58f] px-1.5 py-px rounded-sm"
      >{{ tokens }} tok</span>
    </div>
    <div class="px-2.5 py-2 min-h-[38px] text-[11px] opacity-90">{{ previewText }}</div>
    <Handle id="messages" type="target" :position="Position.Left" :style="{ top: '40%' }" />
    <Handle id="userMessage" type="target" :position="Position.Left" :style="{ top: '60%' }" />
    <Handle id="text" type="source" :position="Position.Right" :style="{ top: '40%' }" />
    <Handle id="messages" type="source" :position="Position.Right" :style="{ top: '60%' }" />
  </div>
</template>
