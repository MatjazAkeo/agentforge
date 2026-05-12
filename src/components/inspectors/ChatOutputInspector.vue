<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { ChatOutputConfig } from '@/domain/node-types';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ChatOutputConfig | null);

function update(key: keyof ChatOutputConfig, value: ChatOutputConfig[keyof ChatOutputConfig]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Format
      <select
        :value="cfg.format"
        @change="(e) => update('format', (e.target as HTMLSelectElement).value as ChatOutputConfig['format'])"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
      >
        <option value="markdown">markdown</option>
        <option value="text">text</option>
      </select>
    </label>
    <div class="text-xs opacity-60">
      Renders the assistant turn in the chat sidebar. <code class="font-mono">markdown</code> applies basic
      formatting; <code class="font-mono">text</code> renders verbatim.
    </div>
    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[{ id: 'context', type: 'context', description: 'The assistant reply to display (last message text).' }]"
    />
  </div>
</template>
