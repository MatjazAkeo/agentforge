<script setup lang="ts">
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

defineProps<{ nodeId: string }>();
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="text-xs opacity-60">
      Receives the user's submission from the chat sidebar at run time. Wire <code class="font-mono">context</code> into your LLM Call's or Agent's <code class="font-mono">context</code> input.
    </div>
    <IOValues :node-id="nodeId" />
    <PortLegend
      :outputs="[
        { id: 'context', type: 'context', description: 'Full chat history with multimodal content (images) embedded in the latest user message.' },
      ]"
    />
  </div>
</template>
