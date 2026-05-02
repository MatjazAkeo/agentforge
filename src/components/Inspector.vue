<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGraphStore } from '@/stores/graph';
import InputInspector from './inspectors/InputInspector.vue';
import OutputInspector from './inspectors/OutputInspector.vue';
import LLMCallInspector from './inspectors/LLMCallInspector.vue';

const ui = useUiStore();
const graph = useGraphStore();

const selectedNode = computed(() => {
  if (!ui.selectedNodeId) return null;
  return graph.nodes.find((n) => n.id === ui.selectedNodeId) ?? null;
});
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-3 py-2 border-b border-border-base">
      <strong>Inspector</strong>
    </div>
    <div v-if="!selectedNode" class="p-5 opacity-50 text-center text-xs">
      Select a node
    </div>
    <div v-else class="p-3">
      <div class="flex justify-between pb-2 mb-3 border-b border-border-base">
        <div class="font-semibold">{{ selectedNode.type }}</div>
        <div class="opacity-50 font-mono text-[11px]">{{ selectedNode.id.slice(0, 8) }}…</div>
      </div>
      <div v-if="selectedNode.type === 'input'">
        <InputInspector :nodeId="selectedNode.id" />
      </div>
      <div v-else-if="selectedNode.type === 'output'">
        <OutputInspector :nodeId="selectedNode.id" />
      </div>
      <div v-else-if="selectedNode.type === 'llm-call'">
        <LLMCallInspector :nodeId="selectedNode.id" />
      </div>
      <div v-else class="opacity-50 text-xs">Inspector for {{ selectedNode.type }} added in a later task.</div>
    </div>
  </div>
</template>
