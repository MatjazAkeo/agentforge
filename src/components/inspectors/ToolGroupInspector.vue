<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { ToolGroupConfig } from '@/domain/node-types';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ToolGroupConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);

const members = computed(() =>
  (result.value?.details?.members as Array<{ name: string; description: string }> | undefined) ?? [],
);

const errorMessage = computed(() => result.value?.errorMessage ?? null);

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
      <div class="text-[10px] uppercase opacity-60 font-mono">Members</div>
      <div v-if="members.length === 0" class="text-xs opacity-50 italic">— no run yet, or empty group —</div>
      <ul v-else class="flex flex-col gap-1.5">
        <li
          v-for="m in members"
          :key="m.name"
          class="bg-panel rounded px-2 py-1.5 text-xs"
        >
          <div class="font-mono">{{ m.name }}</div>
          <div class="opacity-60 text-[11px]">{{ m.description }}</div>
        </li>
      </ul>
    </section>

    <section v-if="errorMessage">
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1 text-error">Error</div>
      <pre class="bg-panel px-2 py-1.5 rounded text-xs whitespace-pre-wrap m-0 text-[#f5a5a5]">{{ errorMessage }}</pre>
    </section>
  </div>
</template>
