<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { InputConfig } from '@/domain/node-types';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as InputConfig | null);

function update<K extends keyof InputConfig>(key: K, value: InputConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="form">
    <label>Name <input :value="cfg.name" @input="(e) => update('name', (e.target as HTMLInputElement).value)"></label>
    <label>Value type
      <select :value="cfg.valueType" @change="(e) => update('valueType', (e.target as HTMLSelectElement).value as InputConfig['valueType'])">
        <option value="text">text</option>
        <option value="number">number</option>
        <option value="json">json</option>
      </select>
    </label>
    <label>Default value
      <textarea :value="String(cfg.defaultValue ?? '')" @input="(e) => update('defaultValue', (e.target as HTMLTextAreaElement).value)" rows="3"></textarea>
    </label>
  </div>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 10px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; opacity: 0.85; }
input, select, textarea { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 12px; font-family: var(--font-ui); }
textarea { resize: vertical; }
</style>
