<script setup lang="ts">
import { computed } from 'vue';
import { VueFlow, type Node as VFNode, type Edge as VFEdge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import { useGraphStore } from '@/stores/graph';
import { useUiStore } from '@/stores/ui';

const graph = useGraphStore();
const ui = useUiStore();

const flowNodes = computed<VFNode[]>(() =>
  graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { config: n.config },
  })),
);

const flowEdges = computed<VFEdge[]>(() =>
  graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  })),
);

function onNodeClick({ node }: { node: VFNode }) {
  ui.selectedNodeId = node.id;
}
function onPaneClick() {
  ui.selectedNodeId = null;
}
function onNodeDragStop({ node }: { node: VFNode }) {
  graph.updateNodePosition(node.id, node.position.x, node.position.y);
}
</script>

<template>
  <div class="canvas">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :fit-view-on-init="true"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @node-drag-stop="onNodeDragStop"
    >
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style scoped>
.canvas { width: 100%; height: 100%; }
</style>
