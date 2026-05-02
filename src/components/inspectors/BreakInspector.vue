<script setup lang="ts">
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';
defineProps<{ nodeId: string }>();
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="text-xs opacity-60">
      Break sits at a loop's exit. It does not fire until its parent Loop Controller terminates,
      then forwards the latest <code class="font-mono">value</code> to downstream nodes.
    </div>
    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[{ id: 'value', type: 'json', description: 'Latest body value to forward when the loop exits.' }]"
      :outputs="[{ id: 'value', type: 'json', description: 'Forwarded after loop termination.' }]"
    />
  </div>
</template>
