<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGraphStore } from '@/stores/graph';
import InputInspector from './inspectors/InputInspector.vue';
import OutputInspector from './inspectors/OutputInspector.vue';
import LLMCallInspector from './inspectors/LLMCallInspector.vue';
import ToolInspector from './inspectors/ToolInspector.vue';
import ToolGroupInspector from './inspectors/ToolGroupInspector.vue';
import ToolRunnerInspector from './inspectors/ToolRunnerInspector.vue';
import LoopControllerInspector from './inspectors/LoopControllerInspector.vue';
import BreakInspector from './inspectors/BreakInspector.vue';

const ui = useUiStore();
const graph = useGraphStore();

const selectedNode = computed(() => {
  if (!ui.selectedNodeId) return null;
  return graph.nodes.find((n) => n.id === ui.selectedNodeId) ?? null;
});
</script>

<template>
  <div class="flex flex-col h-full text-sm">
    <div class="px-3.5 py-2.5 border-b border-border-base">
      <strong class="text-base">Inspector</strong>
    </div>
    <div v-if="!selectedNode" class="p-5 opacity-50 text-center">
      Select a node
    </div>
    <div v-else class="p-3.5">
      <div class="flex justify-between items-center pb-2.5 mb-3.5 border-b border-border-base">
        <div class="font-semibold">{{ selectedNode.type }}</div>
        <div class="opacity-50 font-mono text-xs">{{ selectedNode.id.slice(0, 8) }}…</div>
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
      <div v-else-if="selectedNode.type === 'tool'">
        <ToolInspector :nodeId="selectedNode.id" />
      </div>
      <div v-else-if="selectedNode.type === 'tool-group'">
        <ToolGroupInspector :nodeId="selectedNode.id" />
      </div>
      <div v-else-if="selectedNode.type === 'tool-runner'">
        <ToolRunnerInspector :nodeId="selectedNode.id" />
      </div>
      <div v-else-if="selectedNode.type === 'loop-controller'">
        <LoopControllerInspector :nodeId="selectedNode.id" />
      </div>
      <div v-else-if="selectedNode.type === 'break'">
        <BreakInspector :nodeId="selectedNode.id" />
      </div>
      <div v-else class="opacity-50">Inspector for {{ selectedNode.type }} added in a later task.</div>
    </div>
  </div>
</template>
