<script setup lang="ts">
import { computed, ref } from 'vue';
import ConnectionPanel from './toolpack/ConnectionPanel.vue';
import SchemaPanel from './toolpack/SchemaPanel.vue';
import ToolListEditor from './toolpack/ToolListEditor.vue';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';
import { useGraphStore } from '@/stores/graph';
import { dbRegistry } from '@/sqlite/db-registry';
import type { ToolPackConfig } from '@/domain/node-types';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const refreshKey = ref(0);

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ToolPackConfig | null);
const flavor = computed(() => cfg.value?.flavor ?? 'none');

function onSchemaReloaded() { refreshKey.value++; }

function setFlavor(next: 'none' | 'sqlite') {
  const current = flavor.value;
  if (current === next) return;
  // Switching away from sqlite tears down the DB worker for this node so
  // we don't leak it; the connection object resets to the new flavor's shape.
  if (current === 'sqlite') {
    dbRegistry.dispose(props.nodeId);
  }
  const connection = next === 'sqlite'
    ? { db: '', sourcePath: undefined, sizeBytes: 0 }
    : {};
  graph.updateNodeConfig(props.nodeId, { flavor: next, connection });
  refreshKey.value++;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <div class="text-xs opacity-60">Flavor</div>
      <div class="flex gap-1">
        <button
          type="button"
          @click="setFlavor('none')"
          :class="[
            'flex-1 px-2 py-1 text-[11px] border rounded cursor-pointer',
            flavor === 'none' ? 'bg-accent/15 text-accent border-accent' : 'bg-elev border-border-base hover:bg-elev/70',
          ]"
          title="A plain tool list with no backend helper"
        >Plain</button>
        <button
          type="button"
          @click="setFlavor('sqlite')"
          :class="[
            'flex-1 px-2 py-1 text-[11px] border rounded cursor-pointer',
            flavor === 'sqlite' ? 'bg-accent/15 text-accent border-accent' : 'bg-elev border-border-base hover:bg-elev/70',
          ]"
          title="Tool bodies get a `sqlite` helper bound for read/write SQL"
        >SQLite</button>
      </div>
      <div v-if="flavor === 'none'" class="text-text-dim text-[10px] leading-snug">
        No backend connection. Tool bodies run with only their <code>inputs</code> argument in scope.
      </div>
    </div>

    <template v-if="flavor === 'sqlite'">
      <ConnectionPanel :node-id="nodeId" @schema-reloaded="onSchemaReloaded" />
      <SchemaPanel :node-id="nodeId" :refresh-key="refreshKey" />
    </template>

    <ToolListEditor :node-id="nodeId" />
    <IOValues :node-id="nodeId" />
    <PortLegend :outputs="[{ id: 'tools', type: 'tools', description: 'Tool definitions for LLM Call / Agent / Tool Group.' }]" />
  </div>
</template>
