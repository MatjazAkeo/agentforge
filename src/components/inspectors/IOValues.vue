<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRunStore } from '@/stores/run';
import CopyableField from './CopyableField.vue';

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

// When this node ran inside a loop, result.input/output reflect ONLY the last iteration.
// Surface that explicitly so the user knows to consult the iteration tree for full history.
const iterCount = computed(() => result.value?.iterations?.length ?? 0);
</script>

<template>
  <section class="border-t border-border-base">
    <h4
      @click="open = !open"
      class="m-0 py-2.5 text-sm cursor-pointer select-none flex items-center gap-2"
    >
      <span>{{ open ? '▼' : '▶' }} I/O values</span>
      <span
        v-if="iterCount > 1"
        class="text-[10px] opacity-60 font-normal normal-case"
        :title="`This node ran ${iterCount} times inside a loop. Showing last iteration; full per-iteration history is in the Iterations section.`"
      >· latest of {{ iterCount }}</span>
    </h4>

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
            <CopyableField :label="handle" :value="format(value)" />
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
            <CopyableField :label="handle" :value="format(value)" />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
