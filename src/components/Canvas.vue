<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, markRaw } from 'vue';
import { VueFlow, useVueFlow, type Node as VFNode, type Edge as VFEdge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import { useGraphStore } from '@/stores/graph';
import { useUiStore } from '@/stores/ui';
import AddNodeMenu from './AddNodeMenu.vue';
import InputNode from './nodes/InputNode.vue';
import OutputNode from './nodes/OutputNode.vue';
import LLMCallNode from './nodes/LLMCallNode.vue';

const graph = useGraphStore();
const ui = useUiStore();
const { project } = useVueFlow();

const nodeTypes = { input: markRaw(InputNode), output: markRaw(OutputNode), 'llm-call': markRaw(LLMCallNode) } as Record<string, ReturnType<typeof markRaw>>;

const flowNodes = computed<VFNode[]>(() =>
  graph.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: { config: n.config } })),
);
const flowEdges = computed<VFEdge[]>(() =>
  graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
);

const menuOpen = ref(false);
const menuScreenPos = ref({ x: 0, y: 0 });
const menuCanvasPos = ref({ x: 0, y: 0 });
const canvasRef = ref<HTMLDivElement | null>(null);

function openMenuAt(screenX: number, screenY: number) {
  menuScreenPos.value = { x: screenX, y: screenY };
  if (canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect();
    menuCanvasPos.value = project({ x: screenX - rect.left, y: screenY - rect.top });
  }
  menuOpen.value = true;
}

function onPlusClick(e: MouseEvent) {
  e.stopPropagation();
  openMenuAt(e.clientX + 4, e.clientY + 4);
}
function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  openMenuAt(e.clientX, e.clientY);
}
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openMenuAt(window.innerWidth / 2 - 120, 100);
  }
}

function onNodeClick({ node }: { node: VFNode }) { ui.selectedNodeId = node.id; }
function onPaneClick() { ui.selectedNodeId = null; menuOpen.value = false; }
function onNodeDragStop({ node }: { node: VFNode }) { graph.updateNodePosition(node.id, node.position.x, node.position.y); }
function onConnect(params: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) {
  graph.addEdge({
    id: crypto.randomUUID(),
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? '',
    targetHandle: params.targetHandle ?? '',
  });
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div ref="canvasRef" class="w-full h-full relative" @contextmenu="onContextMenu">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :node-types="nodeTypes"
      :fit-view-on-init="true"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @node-drag-stop="onNodeDragStop"
      @connect="onConnect"
    >
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
    <button
      type="button"
      @click="onPlusClick"
      title="Add node (or right-click / ⌘K)"
      class="absolute left-4 top-4 w-9 h-9 rounded-full bg-accent text-white border-0 text-lg cursor-pointer shadow-[0_2px_6px_rgba(0,0,0,0.3)] z-10"
    >+</button>
    <AddNodeMenu :open="menuOpen" :position="menuCanvasPos" :screen-position="menuScreenPos" @close="menuOpen = false" />
  </div>
</template>
