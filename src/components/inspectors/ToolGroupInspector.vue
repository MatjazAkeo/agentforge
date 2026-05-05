<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { ToolGroupConfig, ToolConfig, ToolPackConfig } from '@/domain/node-types';
import PortLegend from './PortLegend.vue';
import IOValues from './IOValues.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ToolGroupConfig | null);

/** Live member list derived from the graph topology — populates as soon as
 *  Tool / Tool Pack / nested Tool Group nodes are connected upstream. No
 *  run required. */
const members = computed(() => {
  const incomingEdges = graph.edges.filter(
    (e) => e.target === props.nodeId && (e.targetHandle ?? '') === 'tools',
  );
  const out: Array<{ name: string; description: string }> = [];
  for (const e of incomingEdges) {
    const upstream = graph.nodes.find((n) => n.id === e.source);
    if (!upstream) continue;
    if (upstream.type === 'tool') {
      const tc = upstream.config as ToolConfig;
      out.push({ name: tc.name ?? '(unnamed)', description: tc.description ?? '' });
    } else if (upstream.type === 'tool-pack') {
      const tp = upstream.config as ToolPackConfig;
      for (const t of tp.tools ?? []) {
        out.push({ name: t.name ?? '(unnamed)', description: t.description ?? '' });
      }
    }
    // tool-group → tool-group fan-in could be supported here too, but it's
    // a rare topology (would imply tools fanning through two groups). Leave
    // for a future polish pass if needed.
  }
  return out;
});

const errorMessage = computed(() => run.current?.nodeResults[props.nodeId]?.errorMessage ?? null);

function update<K extends keyof ToolGroupConfig>(key: K, value: ToolGroupConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Label
      <input
        :value="cfg.label"
        @input="(e) => update('label', (e.target as HTMLInputElement).value)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
        placeholder="e.g. Web tools"
      >
    </label>

    <section class="flex flex-col gap-1.5">
      <div class="text-[10px] uppercase opacity-60 font-mono">Members ({{ members.length }})</div>
      <div v-if="members.length === 0" class="text-xs opacity-50 italic">— connect Tool nodes to populate —</div>
      <ul v-else class="flex flex-col gap-1.5">
        <li
          v-for="(m, i) in members"
          :key="i"
          class="bg-panel rounded px-2 py-1.5 text-xs"
        >
          <div class="font-mono">{{ m.name }}</div>
          <div v-if="m.description" class="opacity-60 text-[11px]">{{ m.description }}</div>
        </li>
      </ul>
    </section>

    <section v-if="errorMessage">
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1 text-error">Error</div>
      <pre class="bg-panel px-2 py-1.5 rounded text-xs whitespace-pre-wrap m-0 text-[#f5a5a5]">{{ errorMessage }}</pre>
    </section>

    <IOValues :node-id="nodeId" />

    <PortLegend
      :inputs="[
        { id: 'tools', type: 'tools', description: 'Tool definitions (multi-input — connect any number of Tools).' },
      ]"
      :outputs="[
        { id: 'toolDefinition', type: 'tools', description: 'Aggregated list of all member tools. Wire to an LLM Call.' },
      ]"
    />
  </div>
</template>
