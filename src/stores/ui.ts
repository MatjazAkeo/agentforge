// src/stores/ui.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const leftSidebarCollapsed = ref(false);
  const rightSidebarCollapsed = ref(false);
  const leftActiveTab = ref<'chat' | 'runs'>('runs');
  const selectedNodeId = ref<string | null>(null);
  const settingsOpen = ref(false);

  return {
    leftSidebarCollapsed, rightSidebarCollapsed, leftActiveTab,
    selectedNodeId, settingsOpen,
  };
});
