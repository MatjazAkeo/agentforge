<!-- src/components/Layout.vue -->
<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import Toolbar from './Toolbar.vue';
import LeftTabs from './LeftTabs.vue';
import Inspector from './Inspector.vue';

const ui = useUiStore();
</script>

<template>
  <div class="layout">
    <Toolbar />
    <div class="layout-row">
      <aside v-if="!ui.leftSidebarCollapsed" class="left-panel">
        <LeftTabs />
      </aside>
      <main class="canvas-area">
        <!-- Canvas component injected in Task 8 -->
        <div class="canvas-placeholder">canvas — added in Task 8</div>
      </main>
      <aside v-if="!ui.rightSidebarCollapsed" class="right-panel">
        <Inspector />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; flex-direction: column; height: 100%; }
.layout-row { flex: 1; display: flex; min-height: 0; }
.left-panel { width: 240px; border-right: 1px solid var(--border); background: var(--bg-panel); display: flex; flex-direction: column; }
.right-panel { width: 280px; border-left: 1px solid var(--border); background: var(--bg-panel); display: flex; flex-direction: column; overflow-y: auto; }
.canvas-area { flex: 1; min-width: 0; position: relative; background: var(--bg-canvas); }
.canvas-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.4; }
</style>
