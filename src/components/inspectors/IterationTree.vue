<script setup lang="ts">
import { ref, computed } from 'vue';
import type { IterationRecord } from '@/domain/run';

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
        <div>
          <div class="text-[10px] uppercase opacity-50 mb-0.5">inputs</div>
          <pre class="bg-elev px-2 py-1.5 rounded text-[11px] whitespace-pre-wrap m-0 max-h-[160px] overflow-auto">{{ format(r.inputs) }}</pre>
        </div>
        <div>
          <div class="text-[10px] uppercase opacity-50 mb-0.5">output</div>
          <pre class="bg-elev px-2 py-1.5 rounded text-[11px] whitespace-pre-wrap m-0 max-h-[160px] overflow-auto">{{ format(r.output) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
