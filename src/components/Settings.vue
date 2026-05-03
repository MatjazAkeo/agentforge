<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '@/stores/ui';
import ApiKeyTab from './settings/ApiKeyTab.vue';
import ModelsTab from './settings/ModelsTab.vue';
import GeneralTab from './settings/GeneralTab.vue';

const ui = useUiStore();
const tab = ref<'api-key' | 'models' | 'general'>('api-key');
</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]"
    @click.self="ui.settingsOpen = false"
  >
    <div class="w-[560px] max-w-[90vw] max-h-[85vh] bg-panel border border-border-strong rounded-lg p-4 flex flex-col">
      <div class="flex justify-between items-center mb-3">
        <h2 class="m-0 text-base">Settings</h2>
        <button
          type="button"
          class="bg-transparent border-0 text-text-dim cursor-pointer text-base"
          @click="ui.settingsOpen = false"
        >✕</button>
      </div>
      <div class="flex gap-1.5 mb-4 border-b border-border-base flex-shrink-0">
        <button
          type="button"
          @click="tab = 'api-key'"
          :class="[
            'px-3 py-1.5 bg-transparent border-0 cursor-pointer text-xs border-b-2',
            tab === 'api-key' ? 'text-text-base border-accent' : 'text-text-dim border-transparent',
          ]"
        >API Key</button>
        <button
          type="button"
          @click="tab = 'models'"
          :class="[
            'px-3 py-1.5 bg-transparent border-0 cursor-pointer text-xs border-b-2',
            tab === 'models' ? 'text-text-base border-accent' : 'text-text-dim border-transparent',
          ]"
        >Models</button>
        <button
          type="button"
          @click="tab = 'general'"
          :class="[
            'px-3 py-1.5 bg-transparent border-0 cursor-pointer text-xs border-b-2',
            tab === 'general' ? 'text-text-base border-accent' : 'text-text-dim border-transparent',
          ]"
        >General</button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <ApiKeyTab v-if="tab === 'api-key'" />
        <ModelsTab v-else-if="tab === 'models'" />
        <GeneralTab v-else-if="tab === 'general'" />
      </div>
    </div>
  </div>
</template>
