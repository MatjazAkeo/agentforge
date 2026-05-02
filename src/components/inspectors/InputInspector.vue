<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { InputConfig } from '@/domain/node-types';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as InputConfig | null);

function update<K extends keyof InputConfig>(key: K, value: InputConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Name
      <input
        :value="cfg.name"
        @input="(e) => update('name', (e.target as HTMLInputElement).value)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
      >
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Default value
      <textarea
        :value="cfg.defaultValue ?? ''"
        @input="(e) => update('defaultValue', (e.target as HTMLTextAreaElement).value)"
        rows="3"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui resize-y"
      ></textarea>
    </label>
  </div>
</template>
