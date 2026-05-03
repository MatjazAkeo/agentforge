<script setup lang="ts">
import { ref } from 'vue';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useRunsStore } from '@/stores/runs';
import RunRow from './RunRow.vue';
import RunRowContextMenu from './RunRowContextMenu.vue';

const runs = useRunsStore();

const menu = ref<{ path: string; x: number; y: number } | null>(null);

function onRowClick(path: string) {
  void runs.loadRun(path);
}

function onRowContextMenu(path: string, x: number, y: number) {
  menu.value = { path, x, y };
}

function onMenuDelete() {
  if (menu.value) void runs.deleteRunFile(menu.value.path);
}

async function onMenuReveal() {
  if (!menu.value) return;
  try {
    await revealItemInDir(menu.value.path);
  } catch (e) {
    console.error('Failed to reveal:', e);
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div v-if="runs.list.length === 0" class="flex items-center justify-center h-full opacity-50 text-xs">
      No runs yet
    </div>
    <div v-else class="flex flex-col">
      <RunRow
        v-for="r in runs.list"
        :key="r.path"
        :summary="r"
        :loaded="runs.loadedRunPath === r.path"
        @click="onRowClick"
        @contextmenu="onRowContextMenu"
      />
    </div>
    <RunRowContextMenu
      v-if="menu"
      :x="menu.x"
      :y="menu.y"
      @delete="onMenuDelete"
      @reveal="onMenuReveal"
      @close="menu = null"
    />
  </div>
</template>
