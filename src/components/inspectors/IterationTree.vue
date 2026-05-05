<script setup lang="ts">
import { ref, computed } from 'vue';
import type { IterationRecord } from '@/domain/run';
import CopyableField from './CopyableField.vue';

const props = defineProps<{ iterations: IterationRecord[] }>();
const expanded = ref<Set<number>>(new Set());

function toggle(i: number) {
  expanded.value.has(i) ? expanded.value.delete(i) : expanded.value.add(i);
  expanded.value = new Set(expanded.value);
}

const empty = computed(() => props.iterations.length === 0);

function format(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="empty" class="text-xs opacity-50 italic">— no iterations yet —</div>
    <div v-for="r in iterations" :key="r.iteration" class="bg-panel rounded">
      <button
        type="button"
        @click="toggle(r.iteration)"
        class="w-full flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer bg-transparent border-0"
      >
        <span class="font-mono">iter {{ r.iteration }}</span>
        <span class="opacity-60">{{ expanded.has(r.iteration) ? '▼' : '▶' }}</span>
      </button>
      <div v-if="expanded.has(r.iteration)" class="px-2 pb-2 flex flex-col gap-1.5">
        <CopyableField label="inputs" :value="format(r.inputs)" />
        <CopyableField label="output" :value="format(r.output)" />
      </div>
    </div>
  </div>
</template>
