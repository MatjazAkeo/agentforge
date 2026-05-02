// src/stores/ui.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const leftSidebarCollapsed = ref(false);
  const rightSidebarCollapsed = ref(false);
  const leftActiveTab = ref<'chat' | 'runs'>('runs');
  const selectedNodeId = ref<string | null>(null);
  const settingsOpen = ref(false);

  const trustPromptOpen = ref(false);
  const trustGraphPath = ref<string | null>(null);
  let trustResolve: ((decision: 'allow' | 'reject') => void) | null = null;

  function askForTrust(path: string): Promise<'allow' | 'reject'> {
    trustGraphPath.value = path;
    trustPromptOpen.value = true;
    return new Promise((resolve) => { trustResolve = resolve; });
  }

  function resolveTrust(decision: 'allow' | 'reject') {
    trustPromptOpen.value = false;
    if (trustResolve) {
      trustResolve(decision);
      trustResolve = null;
    }
  }

  return {
    leftSidebarCollapsed, rightSidebarCollapsed, leftActiveTab,
    selectedNodeId, settingsOpen,
    trustPromptOpen, trustGraphPath, askForTrust, resolveTrust,
  };
});
