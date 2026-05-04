<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import Toolbar from './Toolbar.vue';
import LeftTabs from './LeftTabs.vue';
import Inspector from './Inspector.vue';
import Canvas from './Canvas.vue';
import SidebarResizer from './SidebarResizer.vue';

const ui = useUiStore();

function onLeftResize(dx: number) {
  ui.setLeftSidebarWidth(ui.leftSidebarWidth + dx);
}
function onRightResize(dx: number) {
  ui.setRightSidebarWidth(ui.rightSidebarWidth + dx);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <Toolbar />
    <div class="flex-1 flex min-h-0">
      <aside
        v-if="!ui.leftSidebarCollapsed"
        class="relative border-r border-border-base bg-panel flex flex-col shrink-0"
        :style="{ width: ui.leftSidebarWidth + 'px' }"
      >
        <LeftTabs />
        <SidebarResizer side="left" :on-resize="onLeftResize" />
      </aside>
      <button
        v-else
        type="button"
        @click="ui.toggleLeftSidebar()"
        title="Show left sidebar"
        aria-label="Show left sidebar"
        class="self-start mt-2 ml-1 h-7 w-5 inline-flex items-center justify-center rounded-r border border-border-base border-l-0 bg-panel text-text-dim hover:text-text-base text-xs leading-none"
      >›</button>
      <main class="flex-1 min-w-0 relative bg-canvas">
        <Canvas />
      </main>
      <aside
        v-if="!ui.rightSidebarCollapsed"
        class="relative border-l border-border-base bg-panel flex flex-col overflow-y-auto shrink-0"
        :style="{ width: ui.rightSidebarWidth + 'px' }"
      >
        <SidebarResizer side="right" :on-resize="onRightResize" />
        <Inspector />
      </aside>
      <button
        v-else
        type="button"
        @click="ui.toggleRightSidebar()"
        title="Show right sidebar"
        aria-label="Show right sidebar"
        class="self-start mt-2 mr-1 h-7 w-5 inline-flex items-center justify-center rounded-l border border-border-base border-r-0 bg-panel text-text-dim hover:text-text-base text-xs leading-none"
      >‹</button>
    </div>
  </div>
</template>
