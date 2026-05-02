<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { PromptTemplateConfig } from '@/domain/node-types';
import { extractPlaceholders } from '@/nodes/_internals/template-vars';
import MonacoEditor from '@/components/MonacoEditor.vue';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as PromptTemplateConfig | null);
const placeholders = computed(() => extractPlaceholders(cfg.value?.template ?? ''));

function update(key: keyof PromptTemplateConfig, value: string) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Template
      <div class="rounded border border-border-base overflow-hidden">
        <MonacoEditor
          :model-value="cfg.template ?? ''"
          @update:model-value="(v: string) => update('template', v)"
          language="markdown"
          height="200px"
        />
      </div>
      <div class="text-[11px] opacity-60">
        Use <code class="font-mono">&#123;&#123;name&#125;&#125;</code> to declare an input port. Each unique
        placeholder becomes a target handle on the card.
      </div>
    </label>

    <section v-if="placeholders.length">
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1.5">Detected ({{ placeholders.length }})</div>
      <ul class="flex flex-col gap-1 text-[11px] font-mono">
        <li v-for="name in placeholders" :key="name" class="opacity-80">{{ name }}</li>
      </ul>
    </section>

    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[{ id: '<varname>', type: 'json', description: 'One target per {{varname}} in the template.' }]"
      :outputs="[{ id: 'text', type: 'string', description: 'The template with all placeholders substituted.' }]"
    />
  </div>
</template>
