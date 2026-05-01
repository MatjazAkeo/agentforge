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
  <div class="form">
    <label v-if="cfg">Format
      <select :value="cfg.format" @change="(e) => update('format', (e.target as HTMLSelectElement).value)">
        <option value="auto">auto</option>
        <option value="text">text</option>
        <option value="json">json</option>
        <option value="markdown">markdown</option>
      </select>
    </label>
    <section class="value">
      <div class="label">Value</div>
      <pre>{{ result?.details?.value ?? '— not yet run —' }}</pre>
    </section>
  </div>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 10px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; opacity: 0.85; }
select { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 12px; }
.value .label { opacity: 0.6; font-size: 10px; text-transform: uppercase; }
pre { background: var(--bg-panel); padding: 8px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
</style>
