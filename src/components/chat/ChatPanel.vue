<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useChatStore } from '@/stores/chat';
import { useGraphStore } from '@/stores/graph';
import { useSettingsStore } from '@/stores/settings';
import type { Graph } from '@/domain/graph';
import ChatBubble from './ChatBubble.vue';

const chat = useChatStore();
const graphStore = useGraphStore();
const settings = useSettingsStore();

const input = ref('');
const scroller = ref<HTMLDivElement | null>(null);

async function onSubmit() {
  if (!input.value.trim() || chat.status === 'running') return;
  const text = input.value;
  input.value = '';
  // Build a plain Graph snapshot from store state for the runner.
  // graphStore.graph is the reactive Graph object (Pinia unwraps the ref).
  const g = graphStore.graph;
  const snapshot: Graph = {
    schemaVersion: g.schemaVersion,
    id: g.id,
    name: g.name,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    nodes: g.nodes,
    edges: g.edges,
    containsCustomCode: g.containsCustomCode,
  };
  await chat.submit({ graph: snapshot, apiKey: settings.apiKey ?? '', userMessage: text });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSubmit();
  }
}

watch(
  () => [chat.thread.length, chat.status],
  async () => {
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
);
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between px-3 py-2 border-b border-border-base">
      <strong class="text-xs uppercase tracking-wide opacity-70">Chat</strong>
      <button
        type="button"
        @click="chat.clear()"
        class="text-text-dim hover:text-text-base text-[11px]"
        :disabled="chat.status === 'running'"
      >Clear</button>
    </div>

    <div ref="scroller" class="flex-1 overflow-y-auto p-3">
      <div v-if="chat.thread.length === 0" class="text-center opacity-50 text-xs italic mt-8">
        No messages yet. Type below to start a turn.
      </div>
      <ChatBubble
        v-for="(t, i) in chat.thread"
        :key="i"
        :role="t.role"
        :content="t.content"
      />
      <div v-if="chat.status === 'running'" class="text-text-dim italic text-xs px-1 mb-2">
        running…
      </div>
    </div>

    <div class="border-t border-border-base p-2">
      <textarea
        v-model="input"
        @keydown="onKeydown"
        placeholder="Type a message — Enter to send, Shift+Enter for newline"
        rows="2"
        class="w-full bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui resize-none"
        :disabled="chat.status === 'running'"
      ></textarea>
    </div>
  </div>
</template>
