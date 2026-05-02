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
import { getSourcePortType, getTargetPortType } from '@/nodes/port-types';
import type { Node } from '@/domain/graph';
import type { NodeType } from '@/domain/node-types';
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
const { project, viewport, getNodes, getSelectedNodes } = useVueFlow();

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
// Snap-on-release targets — the node.position the dragged node should snap to if released now.
const snapTargetX = ref<number | null>(null);
const snapTargetY = ref<number | null>(null);

// In-app clipboard for copy/paste — stores a node's type+config snapshot, no edges.
const clipboard = ref<{ type: NodeType; config: Record<string, unknown> } | null>(null);

function isTypingInField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return el.isContentEditable === true;
}

/** Returns the node Vue Flow currently considers selected (visual selection),
 *  falling back to our store's selectedNodeId. Vue Flow is the source of truth. */
function currentlySelectedNode(): Node | null {
  const vfSelected = getSelectedNodes.value;
  if (vfSelected.length > 0) {
    const id = vfSelected[0].id;
    return graph.nodes.find((n) => n.id === id) ?? null;
  }
  if (ui.selectedNodeId) {
    return graph.nodes.find((n) => n.id === ui.selectedNodeId) ?? null;
  }
  return null;
}

function copySelected() {
  const node = currentlySelectedNode();
  if (!node) return;
  clipboard.value = {
    type: node.type,
    config: structuredClone(node.config) as Record<string, unknown>,
  };
}

function pasteFromClipboard() {
  if (!clipboard.value) return;
  const anchor = currentlySelectedNode()?.position ?? null;
  const fallback = canvasRef.value
    ? project({ x: canvasRef.value.clientWidth / 2, y: canvasRef.value.clientHeight / 2 })
    : { x: 100, y: 100 };
  const base = anchor ?? fallback;
  const newNode: Node = {
    id: crypto.randomUUID(),
    type: clipboard.value.type,
    position: { x: base.x + 30, y: base.y + 30 },
    config: structuredClone(clipboard.value.config) as Node['config'],
  };
  graph.addNode(newNode);
  ui.selectedNodeId = newNode.id;
}

/** Duplicate = copy + paste in one action. Bound to ⌘D so it survives the
 *  macOS Edit menu's ⌘C/⌘V interception of plain copy/paste. */
function duplicateSelected() {
  const node = currentlySelectedNode();
  if (!node) return;
  const newNode: Node = {
    id: crypto.randomUUID(),
    type: node.type,
    position: { x: node.position.x + 30, y: node.position.y + 30 },
    config: structuredClone(node.config) as Node['config'],
  };
  graph.addNode(newNode);
  ui.selectedNodeId = newNode.id;
}

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
  // Don't hijack shortcuts while the user is typing in a form control.
  if (isTypingInField(e.target)) return;

  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'k') {
    e.preventDefault();
    openMenuAt(window.innerWidth / 2 - 120, 100);
  } else if (mod && k === 'd') {
    // ⌘D / Ctrl+D — duplicate the selected node in place (works around the
    // macOS Edit-menu's predefined ⌘C/⌘V interception).
    e.preventDefault();
    duplicateSelected();
  } else if (mod && k === 'c') {
    // May not fire on macOS if the Edit menu's Copy item is consuming ⌘C —
    // ⌘D is the reliable shortcut. Kept as a fallback.
    e.preventDefault();
    copySelected();
  } else if (mod && k === 'v') {
    e.preventDefault();
    pasteFromClipboard();
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
  const dragNode = node as VFNode & { dimensions?: { width: number; height: number } };
  const drag = nodeBox(dragNode);
  const w = dragNode.dimensions?.width ?? NODE_DEFAULT_W;
  const h = dragNode.dimensions?.height ?? NODE_DEFAULT_H;

  let lineX: number | null = null;
  let lineY: number | null = null;
  let tx: number | null = null;
  let ty: number | null = null;

  for (const other of getNodes.value) {
    if (other.id === node.id) continue;
    const ob = nodeBox(other);
    // Vertical guides — left/right/center alignments. tx is the new flow-x for the dragged
    // node so its corresponding edge/center lands exactly on the line.
    if (lineX === null) {
      if (Math.abs(drag.minX - ob.minX) <= HELPER_THRESHOLD) { lineX = ob.minX; tx = ob.minX; }
      else if (Math.abs(drag.maxX - ob.maxX) <= HELPER_THRESHOLD) { lineX = ob.maxX; tx = ob.maxX - w; }
      else if (Math.abs(drag.cX - ob.cX) <= HELPER_THRESHOLD) { lineX = ob.cX; tx = ob.cX - w / 2; }
    }
    // Horizontal guides — top/bottom/middle alignments.
    if (lineY === null) {
      if (Math.abs(drag.minY - ob.minY) <= HELPER_THRESHOLD) { lineY = ob.minY; ty = ob.minY; }
      else if (Math.abs(drag.maxY - ob.maxY) <= HELPER_THRESHOLD) { lineY = ob.maxY; ty = ob.maxY - h; }
      else if (Math.abs(drag.cY - ob.cY) <= HELPER_THRESHOLD) { lineY = ob.cY; ty = ob.cY - h / 2; }
    }
    if (lineX !== null && lineY !== null) break;
  }

  helperVx.value = lineX;
  helperHy.value = lineY;
  snapTargetX.value = tx;
  snapTargetY.value = ty;
}

function onNodeDragStop({ node }: { node: VFNode }) {
  const finalX = snapTargetX.value ?? node.position.x;
  const finalY = snapTargetY.value ?? node.position.y;
  graph.updateNodePosition(node.id, finalX, finalY);
  helperVx.value = null;
  helperHy.value = null;
  snapTargetX.value = null;
  snapTargetY.value = null;
}

/** Validates a connection while it's being dragged. Vue Flow calls this on every move
 *  over a candidate target so the line snaps only to compatible handles. Rejects:
 *    - self-loops
 *    - wrong direction (no source for the source handle, or no target for the target)
 *    - data-type mismatch */
function isValidConnection(connection: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): boolean {
  if (connection.source === connection.target) return false;
  const sourceNode = graph.nodes.find((n) => n.id === connection.source);
  const targetNode = graph.nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;
  const sourceType = getSourcePortType(sourceNode, connection.sourceHandle ?? '');
  const targetType = getTargetPortType(targetNode, connection.targetHandle ?? '');
  if (!sourceType || !targetType) return false;
  return sourceType === targetType;
}

function onConnect(params: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) {
  // Targets accept only one incoming edge — replace any existing one so the new wire wins.
  // Sources can fan out to many targets; nothing to clean up there.
  const existing = graph.edges.find(
    (e) => e.target === params.target && (e.targetHandle ?? '') === (params.targetHandle ?? ''),
  );
  if (existing) graph.removeEdge(existing.id);

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

// Capture phase so this runs before Vue Flow's internal keydown handlers.
onMounted(() => window.addEventListener('keydown', onKeydown, true));
onUnmounted(() => window.removeEventListener('keydown', onKeydown, true));
</script>

<template>
  <div ref="canvasRef" class="w-full h-full relative" @contextmenu="onContextMenu">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :node-types="nodeTypes"
      :fit-view-on-init="true"
      :is-valid-connection="isValidConnection"
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
