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
  <div class="node-card llm-card" :style="{ borderColor }">
    <div class="header">
      <strong>LLM Call</strong>
      <div class="sub">{{ data.config.model }}</div>
      <span v-if="tokens !== null" class="badge">{{ tokens }} tok</span>
    </div>
    <div class="body">{{ previewText }}</div>
    <Handle id="messages" type="target" :position="Position.Left" :style="{ top: '40%' }" />
    <Handle id="userMessage" type="target" :position="Position.Left" :style="{ top: '60%' }" />
    <Handle id="text" type="source" :position="Position.Right" :style="{ top: '40%' }" />
    <Handle id="messages-out" type="source" :position="Position.Right" :style="{ top: '60%' }" />
  </div>
</template>

<style scoped>
.node-card { width: 220px; background: var(--bg-panel-strong); border: 2px solid #888; border-radius: 8px; overflow: hidden; }
.header { padding: 8px 10px; background: var(--bg-elev); border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; position: relative; }
.sub { opacity: 0.6; font-size: 10px; }
.badge { position: absolute; right: 8px; top: 8px; font-size: 9px; background: #1f3d1f; color: #8fd58f; padding: 1px 5px; border-radius: 3px; }
.body { padding: 8px 10px; min-height: 38px; font-size: 11px; opacity: 0.9; }
</style>
