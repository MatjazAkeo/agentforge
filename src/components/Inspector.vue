<!-- src/components/Inspector.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGraphStore } from '@/stores/graph';

const ui = useUiStore();
const graph = useGraphStore();

const selectedNode = computed(() => {
  if (!ui.selectedNodeId) return null;
  return graph.nodes.find((n) => n.id === ui.selectedNodeId) ?? null;
});
</script>

<template>
  <div class="inspector">
    <div class="header">
      <strong>Inspector</strong>
    </div>
    <div v-if="!selectedNode" class="empty">Select a node</div>
    <div v-else class="content">
      <div class="node-summary">
        <div class="type">{{ selectedNode.type }}</div>
        <div class="id">{{ selectedNode.id.slice(0, 8) }}…</div>
      </div>
      <!-- Per-type inspectors plugged in by Tasks 10, 11, 17 -->
      <div class="placeholder">Inspector content per type added in later tasks.</div>
    </div>
  </div>
</template>

<style scoped>
.inspector { display: flex; flex-direction: column; height: 100%; }
.header { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.empty { padding: 20px; opacity: 0.5; text-align: center; font-size: 12px; }
.content { padding: 12px; }
.node-summary { display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
.type { font-weight: 600; }
.id { opacity: 0.5; font-family: monospace; font-size: 11px; }
.placeholder { opacity: 0.5; font-size: 12px; }
</style>
