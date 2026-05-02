<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';
import type { PromptTemplateConfig } from '@/domain/node-types';
import { extractPlaceholders } from '@/nodes/_internals/template-vars';

const props = defineProps<{ id: string; data: { config: PromptTemplateConfig } }>();
const graph = useGraphStore();
const run = useRunStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running': case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});
const placeholders = computed(() => extractPlaceholders(props.data.config.template ?? ''));
function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div
    class="node-shell group w-[240px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#ffaa55] flex-shrink-0" title="prompt template" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Prompt Template</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ placeholders.length }} {{ placeholders.length === 1 ? 'var' : 'vars' }}</div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>

    <!-- Dynamic input rows, one per placeholder -->
    <div v-if="placeholders.length === 0" class="px-3 py-2 text-[11px] text-text-dim italic opacity-60">
      No {{ '{{vars}}' }} in template — output is the template literal.
    </div>
    <div
      v-for="name in placeholders"
      :key="name"
      class="relative h-6 flex items-center px-3 text-[11px]"
    >
      <Handle :id="name" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
      <span class="text-text-dim font-mono text-[10px]">{{ name }}</span>
    </div>

    <div class="relative h-6 rounded-b-md flex items-center justify-end pr-3 text-[11px] border-t border-[#16181c] bg-[#16181c]">
      <span class="text-text-dim font-mono text-[10px]">rendered</span>
      <Handle id="rendered" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
    </div>
  </div>
</template>
