<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

// Spec §6.12 UX warning: if userMessage has outgoing edges but messages doesn't,
// AND the graph has an LLM Call or Agent, warn that chat will feel amnesiac.
const warning = computed(() => {
  const userMsgEdges = graph.edges.filter((e) => e.source === props.nodeId && e.sourceHandle === 'userMessage');
  const messagesEdges = graph.edges.filter((e) => e.source === props.nodeId && e.sourceHandle === 'messages');
  if (userMsgEdges.length === 0 || messagesEdges.length > 0) return null;
  const hasLLM = graph.nodes.some((n) => n.type === 'llm-call' || n.type === 'agent');
  if (!hasLLM) return null;
  return 'Connect `messages` for multi-turn context — otherwise the LLM only sees the latest user message and the chat will feel amnesiac across turns.';
});
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="text-xs opacity-60">
      Receives the user's submission from the chat sidebar at run time. Wire <code class="font-mono">messages</code> into your LLM Call's <code class="font-mono">messages</code> input for multi-turn chat.
    </div>
    <div v-if="warning" class="bg-yellow-500/15 border border-yellow-500/40 rounded px-2 py-1.5 text-[11px] text-yellow-200">
      ⚠ {{ warning }}
    </div>
    <IOValues :node-id="nodeId" />
    <PortLegend
      :outputs="[
        { id: 'userMessage', type: 'string', description: 'The latest user message (single turn).' },
        { id: 'messages', type: 'messages', description: 'Full chat history including the latest user message.' },
      ]"
    />
  </div>
</template>
