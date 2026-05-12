<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { ContextGroupConfig } from '@/domain/node-types';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ContextGroupConfig | null);

const inputCount = computed(
  () =>
    graph.edges.filter(
      (e) => e.target === props.nodeId && (e.targetHandle ?? '') === 'contexts',
    ).length,
);

function update<K extends keyof ContextGroupConfig>(key: K, value: ContextGroupConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Label
      <input
        :value="cfg.label"
        @input="(e) => update('label', (e.target as HTMLInputElement).value)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
        placeholder="optional cosmetic label"
      >
    </label>

    <section class="flex flex-col gap-1.5">
      <div class="text-[10px] uppercase opacity-60 font-mono">Inputs ({{ inputCount }})</div>
      <div v-if="inputCount === 0" class="text-xs opacity-50 italic">— connect context sources to populate —</div>
    </section>

    <IOValues :node-id="nodeId" />

    <PortLegend
      :inputs="[
        { id: 'contexts', type: 'context', description: 'Multi-edge fan-in. Merges via merge-last-user (OpenRouter-aligned).' },
      ]"
      :outputs="[
        { id: 'context', type: 'context', description: 'Merged context: systems pooled + deduped, body messages concatenated in edge order, last-user messages folded into one multimodal user message at the end.' },
      ]"
    />
  </div>
</template>
