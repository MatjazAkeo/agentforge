<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useGraphStore } from '@/stores/graph';
import RunsList from './runs/RunsList.vue';
import ChatPanel from './chat/ChatPanel.vue';

const ui = useUiStore();
const graph = useGraphStore();

const isChatActive = computed(() => {
  const ins = graph.nodes.filter((n) => n.type === 'chat-input').length;
  const outs = graph.nodes.filter((n) => n.type === 'chat-output').length;
  return ins === 1 && outs === 1;
});
</script>

<template>
  <div class="flex flex-col h-full text-sm">
    <div class="flex border-b border-border-base items-stretch">
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
      <button
        type="button"
        @click="ui.toggleLeftSidebar()"
        title="Hide sidebar"
        aria-label="Hide sidebar"
        class="px-2 text-text-dim hover:text-text-base cursor-pointer border-b-2 border-transparent"
      >‹</button>
    </div>
    <div class="flex-1 overflow-hidden">
      <template v-if="ui.leftActiveTab === 'chat'">
        <ChatPanel v-if="isChatActive" />
        <div v-else class="flex items-center justify-center h-full opacity-50 p-3.5 text-center text-xs">
          This graph isn't a chat agent — add exactly one Chat Input + one Chat Output node to enable chat mode.
        </div>
      </template>
      <RunsList v-else />
    </div>
  </div>
</template>
