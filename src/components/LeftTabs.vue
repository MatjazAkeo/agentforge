<!-- src/components/LeftTabs.vue -->
<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div class="left-tabs">
    <div class="tab-bar">
      <button :class="['tab', { active: ui.leftActiveTab === 'chat' }]" @click="ui.leftActiveTab = 'chat'">Chat</button>
      <button :class="['tab', { active: ui.leftActiveTab === 'runs' }]" @click="ui.leftActiveTab = 'runs'">Runs</button>
    </div>
    <div class="tab-body">
      <div v-if="ui.leftActiveTab === 'chat'" class="empty">Not a chat graph</div>
      <div v-else class="empty">No runs yet</div>
    </div>
  </div>
</template>

<style scoped>
.left-tabs { display: flex; flex-direction: column; height: 100%; }
.tab-bar { display: flex; border-bottom: 1px solid var(--border); }
.tab { flex: 1; padding: 8px; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 12px; }
.tab.active { color: var(--text); background: var(--bg-elev); border-bottom: 2px solid var(--accent); }
.tab-body { flex: 1; overflow-y: auto; padding: 12px; }
.empty { display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.5; font-size: 12px; }
</style>
