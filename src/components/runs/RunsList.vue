<script setup lang="ts">
import { useRunsStore } from '@/stores/runs';
import RunRow from './RunRow.vue';

const runs = useRunsStore();

function onRowClick(path: string) {
  // Loading runs into the canvas is wired up in Task 17 — for now just remember the selection
  runs.loadedRunPath = path;
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
      />
    </div>
  </div>
</template>
