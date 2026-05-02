<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, markRaw } from 'vue';
import { VueFlow, useVueFlow, type Node as VFNode, type Edge as VFEdge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls, ControlButton } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import { useGraphStore } from '@/stores/graph';
import { useUiStore } from '@/stores/ui';
import AddNodeMenu from './AddNodeMenu.vue';
import HelperLines from './HelperLines.vue';
import InputNode from './nodes/InputNode.vue';
import OutputNode from './nodes/OutputNode.vue';
import LLMCallNode from './nodes/LLMCallNode.vue';

const GRID = 20;
const HELPER_THRESHOLD = 5; // px in flow coords
const NODE_DEFAULT_W = 220;
const NODE_DEFAULT_H = 80;

const graph = useGraphStore();
const ui = useUiStore();
const { project, viewport, getNodes } = useVueFlow();

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

// Helper-line state — flow-coordinates of vertical/horizontal alignment guides shown during drag.
const helperVx = ref<number | null>(null);
const helperHy = ref<number | null>(null);

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

function nodeBox(n: { position: { x: number; y: number }; dimensions?: { width: number; height: number } }) {
  const w = n.dimensions?.width ?? NODE_DEFAULT_W;
  const h = n.dimensions?.height ?? NODE_DEFAULT_H;
  return {
    minX: n.position.x,
    maxX: n.position.x + w,
    cX: n.position.x + w / 2,
    minY: n.position.y,
    maxY: n.position.y + h,
    cY: n.position.y + h / 2,
  };
}

function onNodeDrag({ node }: { node: VFNode }) {
  const drag = nodeBox(node as any);
  let lineX: number | null = null;
  let lineY: number | null = null;

  for (const other of getNodes.value) {
    if (other.id === node.id) continue;
    const ob = nodeBox(other as any);
    // Vertical guides — left/right/center alignments
    if (lineX === null) {
      if (Math.abs(drag.minX - ob.minX) <= HELPER_THRESHOLD) lineX = ob.minX;
      else if (Math.abs(drag.maxX - ob.maxX) <= HELPER_THRESHOLD) lineX = ob.maxX;
      else if (Math.abs(drag.cX - ob.cX) <= HELPER_THRESHOLD) lineX = ob.cX;
    }
    // Horizontal guides — top/bottom/middle alignments
    if (lineY === null) {
      if (Math.abs(drag.minY - ob.minY) <= HELPER_THRESHOLD) lineY = ob.minY;
      else if (Math.abs(drag.maxY - ob.maxY) <= HELPER_THRESHOLD) lineY = ob.maxY;
      else if (Math.abs(drag.cY - ob.cY) <= HELPER_THRESHOLD) lineY = ob.cY;
    }
    if (lineX !== null && lineY !== null) break;
  }

  helperVx.value = lineX;
  helperHy.value = lineY;
}

function onNodeDragStop({ node }: { node: VFNode }) {
  helperVx.value = null;
  helperHy.value = null;
  graph.updateNodePosition(node.id, node.position.x, node.position.y);
}

function onConnect(params: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) {
  graph.addEdge({
    id: crypto.randomUUID(),
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? '',
    targetHandle: params.targetHandle ?? '',
  });
}

function snapAllNodesToGrid() {
  for (const n of graph.nodes) {
    const x = Math.round(n.position.x / GRID) * GRID;
    const y = Math.round(n.position.y / GRID) * GRID;
    if (x !== n.position.x || y !== n.position.y) {
      graph.updateNodePosition(n.id, x, y);
    }
  }
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
      @node-drag="onNodeDrag"
      @node-drag-stop="onNodeDragStop"
      @connect="onConnect"
    >
      <Background :gap="GRID" />
      <HelperLines
        :vertical-x="helperVx"
        :horizontal-y="helperHy"
        :viewport="{ x: viewport.x, y: viewport.y, zoom: viewport.zoom }"
      />
      <Controls :show-interactive="false">
        <ControlButton
          @click="snapAllNodesToGrid"
          title="Snap all nodes to nearest grid point"
        >
          <!-- 4-dot grid glyph -->
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <circle cx="4" cy="4" r="1.4" />
            <circle cx="12" cy="4" r="1.4" />
            <circle cx="4" cy="12" r="1.4" />
            <circle cx="12" cy="12" r="1.4" />
          </svg>
        </ControlButton>
      </Controls>
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
