<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
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

const graph = useGraphStore();
const ui = useUiStore();
const { project } = useVueFlow();

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

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="canvas" ref="canvasRef" @contextmenu="onContextMenu">
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
    <button class="plus-btn" @click="onPlusClick" title="Add node (or right-click / ⌘K)">+</button>
    <AddNodeMenu :open="menuOpen" :position="menuCanvasPos" :screen-position="menuScreenPos" @close="menuOpen = false" />
  </div>
</template>

<style scoped>
.canvas { width: 100%; height: 100%; position: relative; }
.plus-btn { position: absolute; left: 16px; top: 16px; width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: white; border: none; font-size: 18px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 10; }
</style>
