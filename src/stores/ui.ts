// src/stores/ui.ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const STORAGE_KEY = 'agent-playground.ui';
const DEFAULT_LEFT_WIDTH = 240;
const DEFAULT_RIGHT_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_FRACTION = 0.5; // never wider than half the viewport

interface PersistedUi {
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
}

function loadPersisted(): PersistedUi {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<PersistedUi>;
    return {
      leftSidebarWidth: typeof parsed.leftSidebarWidth === 'number' ? parsed.leftSidebarWidth : DEFAULT_LEFT_WIDTH,
      rightSidebarWidth: typeof parsed.rightSidebarWidth === 'number' ? parsed.rightSidebarWidth : DEFAULT_RIGHT_WIDTH,
      leftSidebarCollapsed: parsed.leftSidebarCollapsed ?? false,
      rightSidebarCollapsed: parsed.rightSidebarCollapsed ?? false,
    };
  } catch { return defaults(); }
}

function defaults(): PersistedUi {
  return {
    leftSidebarWidth: DEFAULT_LEFT_WIDTH,
    rightSidebarWidth: DEFAULT_RIGHT_WIDTH,
    leftSidebarCollapsed: false,
    rightSidebarCollapsed: false,
  };
}

function clampWidth(w: number): number {
  const max = typeof window !== 'undefined' ? Math.floor(window.innerWidth * MAX_SIDEBAR_FRACTION) : 800;
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(max, Math.round(w)));
}

export const useUiStore = defineStore('ui', () => {
  const initial = loadPersisted();

  const leftSidebarWidth = ref(initial.leftSidebarWidth);
  const rightSidebarWidth = ref(initial.rightSidebarWidth);
  const leftSidebarCollapsed = ref(initial.leftSidebarCollapsed);
  const rightSidebarCollapsed = ref(initial.rightSidebarCollapsed);
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

  function setLeftSidebarWidth(w: number) { leftSidebarWidth.value = clampWidth(w); }
  function setRightSidebarWidth(w: number) { rightSidebarWidth.value = clampWidth(w); }
  function toggleLeftSidebar() { leftSidebarCollapsed.value = !leftSidebarCollapsed.value; }
  function toggleRightSidebar() { rightSidebarCollapsed.value = !rightSidebarCollapsed.value; }

  watch(
    [leftSidebarWidth, rightSidebarWidth, leftSidebarCollapsed, rightSidebarCollapsed],
    () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          leftSidebarWidth: leftSidebarWidth.value,
          rightSidebarWidth: rightSidebarWidth.value,
          leftSidebarCollapsed: leftSidebarCollapsed.value,
          rightSidebarCollapsed: rightSidebarCollapsed.value,
        } as PersistedUi));
      } catch { /* ignore quota errors */ }
    },
  );

  return {
    leftSidebarWidth, rightSidebarWidth,
    leftSidebarCollapsed, rightSidebarCollapsed,
    leftActiveTab, selectedNodeId, settingsOpen,
    setLeftSidebarWidth, setRightSidebarWidth,
    toggleLeftSidebar, toggleRightSidebar,
    trustPromptOpen, trustGraphPath, askForTrust, resolveTrust,
  };
});
