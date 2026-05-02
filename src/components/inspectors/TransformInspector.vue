<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { TransformConfig } from '@/domain/node-types';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as TransformConfig | null);

function update<K extends keyof TransformConfig>(key: K, value: TransformConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Mode
      <select
        :value="cfg.mode"
        @change="(e) => update('mode', (e.target as HTMLSelectElement).value as TransformConfig['mode'])"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
      >
        <option value="json-parse">json-parse</option>
        <option value="json-stringify">json-stringify</option>
        <option value="json-path">json-path</option>
        <option value="regex-extract">regex-extract</option>
        <option value="template">template</option>
      </select>
    </label>

    <label v-if="cfg.mode === 'json-path'" class="flex flex-col gap-1 text-xs opacity-85">
      Path
      <input
        :value="cfg.path ?? ''"
        @input="(e) => update('path', (e.target as HTMLInputElement).value)"
        placeholder="e.g. messages[-1].content"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-mono"
      >
      <div class="text-[11px] opacity-60">Dot-separated keys; <code class="font-mono">[n]</code> for arrays; negative indexes count from the end.</div>
    </label>

    <template v-if="cfg.mode === 'regex-extract'">
      <label class="flex flex-col gap-1 text-xs opacity-85">
        Pattern
        <input
          :value="cfg.pattern ?? ''"
          @input="(e) => update('pattern', (e.target as HTMLInputElement).value)"
          placeholder="e.g. order #(\\d+)"
          class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-mono"
        >
      </label>
      <label class="flex flex-col gap-1 text-xs opacity-85">
        Group
        <input
          type="number" min="0"
          :value="cfg.group ?? 0"
          @input="(e) => update('group', parseInt((e.target as HTMLInputElement).value, 10) || 0)"
          class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
        >
        <div class="text-[11px] opacity-60">0 = the whole match. 1+ = capture groups.</div>
      </label>
    </template>

    <label v-if="cfg.mode === 'template'" class="flex flex-col gap-1 text-xs opacity-85">
      Template
      <textarea
        :value="cfg.template ?? ''"
        @input="(e) => update('template', (e.target as HTMLTextAreaElement).value)"
        rows="4"
        placeholder="Hello {{value}}!"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-mono resize-y"
      ></textarea>
      <div class="text-[11px] opacity-60">Use <code class="font-mono">&#123;&#123;value&#125;&#125;</code> to refer to the input.</div>
    </label>

    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[{ id: 'value', type: 'json', description: 'Input value (any shape).' }]"
      :outputs="[{ id: 'result', type: 'json', description: 'Transformed output (mode-dependent).' }]"
    />
  </div>
</template>
