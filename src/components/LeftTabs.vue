<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div class="flex flex-col h-full text-sm">
    <div class="flex border-b border-border-base">
      <button
        type="button"
        @click="ui.leftActiveTab = 'chat'"
        :class="[
          'flex-1 py-2.5 cursor-pointer border-b-2',
          ui.leftActiveTab === 'chat'
            ? 'text-text-base bg-elev border-accent'
            : 'text-text-dim border-transparent',
        ]"
      >Chat</button>
      <button
        type="button"
        @click="ui.leftActiveTab = 'runs'"
        :class="[
          'flex-1 py-2.5 cursor-pointer border-b-2',
          ui.leftActiveTab === 'runs'
            ? 'text-text-base bg-elev border-accent'
            : 'text-text-dim border-transparent',
        ]"
      >Runs</button>
    </div>
    <div class="flex-1 overflow-y-auto p-3.5">
      <div v-if="ui.leftActiveTab === 'chat'" class="flex items-center justify-center h-full opacity-50">
        Not a chat graph
      </div>
      <div v-else class="flex items-center justify-center h-full opacity-50">
        No runs yet
      </div>
    </div>
  </div>
</template>
