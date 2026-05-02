<script setup lang="ts">
import { computed } from 'vue';
import type { RunSummary } from '@/stores/runs';

const props = defineProps<{ summary: RunSummary; loaded: boolean }>();
const emit = defineEmits<{ click: [path: string] }>();

const time = computed(() => {
  // Render HH:MM:SS from ISO timestamp
  const d = new Date(props.summary.startedAt);
  return d.toLocaleTimeString('en-US', { hour12: false });
});

const duration = computed(() => {
  const ms = props.summary.durationMs;
  if (ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});

const statusIcon = computed(() => {
  switch (props.summary.status) {
    case 'completed': return { icon: '✓', color: 'text-success' };
    case 'failed': return { icon: '✕', color: 'text-error' };
    case 'aborted': return { icon: '⊘', color: 'text-warn' };
    default: return { icon: '⟳', color: 'text-accent' };
  }
});
</script>

<template>
  <button
    type="button"
    @click="emit('click', summary.path)"
    :class="[
      'w-full text-left px-3 py-2 text-xs border-b border-border-base last:border-b-0 cursor-pointer transition',
      loaded ? 'bg-accent/15 border-l-2 border-l-accent' : 'hover:bg-elev/40 border-l-2 border-l-transparent',
    ]"
  >
    <div class="flex items-center justify-between mb-1">
      <span :class="['font-mono', statusIcon.color]">{{ statusIcon.icon }} {{ time }}</span>
      <span class="opacity-60 tabular-nums">
        {{ duration }}<template v-if="summary.tokens"> · {{ summary.tokens }}t</template>
      </span>
    </div>
    <div v-if="summary.inputExcerpt" class="opacity-85 truncate">→ "{{ summary.inputExcerpt }}"</div>
    <div v-if="summary.outputExcerpt" class="opacity-60 truncate">← "{{ summary.outputExcerpt }}"</div>
  </button>
</template>
