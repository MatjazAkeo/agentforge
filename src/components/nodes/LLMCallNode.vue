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
    default: return '#2a2a2e';
  }
});
const tokens = computed(() => {
  const u = result.value?.details?.usage as { input: number; output: number } | undefined;
  return u ? u.input + u.output : null;
});
const previewText = computed(() => {
  if (livePreview.value) return livePreview.value;
  const v = result.value?.details?.response as { text?: string } | undefined;
  if (v?.text) return v.text.length > 100 ? `${v.text.slice(0, 100)}…` : v.text;
  if (status.value === 'error') return result.value?.errorMessage ?? 'error';
  return '— not yet run —';
});
</script>

<template>
  <div
    class="node-shell w-[240px] bg-[#0f1014] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.35)] font-ui text-text-base"
    :style="{ borderColor }"
  >
    <!-- Title bar — sky blue for LLM call nodes -->
    <div class="relative rounded-t-md bg-[#1d3a5d] px-3 py-1.5 leading-tight">
      <div class="text-[#d4e8f4] font-semibold text-xs">LLM Call</div>
      <div class="text-[#d4e8f4]/65 text-[10px] font-mono truncate pr-12">{{ data.config.model }}</div>
      <span
        v-if="tokens !== null"
        class="absolute right-2.5 top-1.5 text-[10px] bg-black/35 text-white/95 px-1.5 py-px rounded-sm font-medium font-mono"
      >{{ tokens }} tok</span>
    </div>

    <!-- Inputs -->
    <div class="py-1">
      <div class="relative h-6 flex items-center pl-3 text-[11px]">
        <Handle id="messages" type="target" :position="Position.Left" />
        <span class="text-text-dim font-mono text-[10px]">messages</span>
      </div>
      <div class="relative h-6 flex items-center pl-3 text-[11px]">
        <Handle id="userMessage" type="target" :position="Position.Left" />
        <span class="text-text-dim font-mono text-[10px]">userMessage</span>
      </div>
      <div class="relative h-6 flex items-center pl-3 text-[11px]">
        <Handle id="tools" type="target" :position="Position.Left" />
        <span class="text-text-dim font-mono text-[10px]">tools</span>
      </div>
    </div>

    <!-- Outputs -->
    <div class="py-1 border-t border-[#1f1f23]">
      <div class="relative h-6 flex items-center justify-end pr-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">text</span>
        <Handle id="text" type="source" :position="Position.Right" />
      </div>
      <div class="relative h-6 flex items-center justify-end pr-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">messages</span>
        <Handle id="messages" type="source" :position="Position.Right" />
      </div>
    </div>

    <!-- Live / final preview -->
    <div class="rounded-b-md px-3 py-2 text-[11px] opacity-90 border-t border-[#1f1f23] bg-[#0a0b0e] min-h-[36px]">
      {{ previewText }}
    </div>
  </div>
</template>
