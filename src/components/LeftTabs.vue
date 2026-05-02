<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex border-b border-border-base">
      <button
        type="button"
        @click="ui.leftActiveTab = 'chat'"
        :class="[
          'flex-1 py-2 text-xs cursor-pointer border-b-2',
          ui.leftActiveTab === 'chat'
            ? 'text-text-base bg-elev border-accent'
            : 'text-text-dim border-transparent',
        ]"
      >Chat</button>
      <button
        type="button"
        @click="ui.leftActiveTab = 'runs'"
        :class="[
          'flex-1 py-2 text-xs cursor-pointer border-b-2',
          ui.leftActiveTab === 'runs'
            ? 'text-text-base bg-elev border-accent'
            : 'text-text-dim border-transparent',
        ]"
      >Runs</button>
    </div>
    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="ui.leftActiveTab === 'chat'" class="flex items-center justify-center h-full opacity-50 text-xs">
        Not a chat graph
      </div>
      <div v-else class="flex items-center justify-center h-full opacity-50 text-xs">
        No runs yet
      </div>
    </div>
  </div>
</template>
