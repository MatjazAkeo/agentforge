<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRunStore } from '@/stores/run';

const props = defineProps<{ nodeId: string }>();
const run = useRunStore();
const open = ref(false);
const inputsOpen = ref(true);
const outputsOpen = ref(true);

const result = computed(() => run.current?.nodeResults[props.nodeId]);

const inputEntries = computed(() => {
  const v = result.value?.input;
  if (!v) return [];
  return Object.entries(v);
});

const outputEntries = computed(() => {
  const v = result.value?.output;
  if (!v || typeof v !== 'object') return [];
  return Object.entries(v as Record<string, unknown>);
});

function format(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const hasAny = computed(() => inputEntries.value.length > 0 || outputEntries.value.length > 0);
</script>

<template>
  <section class="border-t border-border-base">
    <h4
      @click="open = !open"
      class="m-0 py-2.5 text-sm cursor-pointer select-none"
    >{{ open ? '▼' : '▶' }} I/O values</h4>

    <div v-show="open" class="pb-3 flex flex-col gap-2.5">
      <div v-if="!hasAny" class="text-xs opacity-50 italic">— no run yet —</div>

      <div v-if="inputEntries.length">
        <button
          type="button"
          @click="inputsOpen = !inputsOpen"
          class="text-[10px] uppercase opacity-60 hover:opacity-90 mb-1.5 select-none cursor-pointer bg-transparent border-0 p-0 font-mono"
        >{{ inputsOpen ? '▼' : '▶' }} inputs ({{ inputEntries.length }})</button>
        <ul v-show="inputsOpen" class="flex flex-col gap-1.5">
          <li v-for="[handle, value] in inputEntries" :key="`in-${handle}`">
            <div class="font-mono text-[11px] opacity-80 mb-0.5">{{ handle }}</div>
            <pre class="bg-panel px-2 py-1.5 rounded text-[11px] whitespace-pre-wrap m-0 max-h-[160px] overflow-auto">{{ format(value) }}</pre>
          </li>
        </ul>
      </div>

      <div v-if="outputEntries.length">
        <button
          type="button"
          @click="outputsOpen = !outputsOpen"
          class="text-[10px] uppercase opacity-60 hover:opacity-90 mb-1.5 select-none cursor-pointer bg-transparent border-0 p-0 font-mono"
        >{{ outputsOpen ? '▼' : '▶' }} outputs ({{ outputEntries.length }})</button>
        <ul v-show="outputsOpen" class="flex flex-col gap-1.5">
          <li v-for="[handle, value] in outputEntries" :key="`out-${handle}`">
            <div class="font-mono text-[11px] opacity-80 mb-0.5">{{ handle }}</div>
            <pre class="bg-panel px-2 py-1.5 rounded text-[11px] whitespace-pre-wrap m-0 max-h-[160px] overflow-auto">{{ format(value) }}</pre>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
