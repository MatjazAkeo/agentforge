<script setup lang="ts">
import { ref } from 'vue';
import ConnectionPanel from './toolpack/ConnectionPanel.vue';
import SchemaPanel from './toolpack/SchemaPanel.vue';
import ToolListEditor from './toolpack/ToolListEditor.vue';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

defineProps<{ nodeId: string }>();
const refreshKey = ref(0);

function onSchemaReloaded() { refreshKey.value++; }
</script>

<template>
  <div class="flex flex-col gap-3">
    <ConnectionPanel :node-id="nodeId" @schema-reloaded="onSchemaReloaded" />
    <SchemaPanel :node-id="nodeId" :refresh-key="refreshKey" />
    <ToolListEditor :node-id="nodeId" />
    <IOValues :node-id="nodeId" />
    <PortLegend :outputs="[{ id: 'tools', type: 'tools', description: 'Tool definitions for LLM Call / Agent / Tool Group.' }]" />
  </div>
</template>
