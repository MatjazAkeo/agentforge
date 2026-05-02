<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { OutputConfig } from '@/domain/node-types';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as OutputConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);

function update(key: keyof OutputConfig, value: string) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <label v-if="cfg" class="flex flex-col gap-1 text-xs opacity-85">
      Format
      <select
        :value="cfg.format"
        @change="(e) => update('format', (e.target as HTMLSelectElement).value)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm"
      >
        <option value="auto">auto</option>
        <option value="text">text</option>
        <option value="json">json</option>
        <option value="markdown">markdown</option>
      </select>
    </label>
    <section>
      <div class="opacity-60 text-[11px] uppercase">Value</div>
      <pre class="bg-panel p-2 rounded text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto m-0">{{ result?.details?.value ?? '— not yet run —' }}</pre>
    </section>
  </div>
</template>
