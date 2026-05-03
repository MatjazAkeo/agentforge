<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import Toolbar from './Toolbar.vue';
import LeftTabs from './LeftTabs.vue';
import Inspector from './Inspector.vue';
import Canvas from './Canvas.vue';

const ui = useUiStore();
</script>

<template>
  <div class="flex flex-col h-full">
    <Toolbar />
    <div class="flex-1 flex min-h-0">
      <aside
        v-if="!ui.leftSidebarCollapsed"
        class="w-60 border-r border-border-base bg-panel flex flex-col"
      >
        <LeftTabs />
      </aside>
      <main class="flex-1 min-w-0 relative bg-canvas">
        <Canvas />
      </main>
      <aside
        v-if="!ui.rightSidebarCollapsed"
        class="w-72 border-l border-border-base bg-panel flex flex-col overflow-y-auto"
      >
        <Inspector />
      </aside>
    </div>
  </div>
</template>
