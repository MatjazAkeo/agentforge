<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { colorForType } from '@/nodes/port-types';
import type { LoopControllerConfig } from '@/domain/node-types';

const props = defineProps<{ id: string; data: { config: LoopControllerConfig } }>();
const graph = useGraphStore();
const run = useRunStore();

const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const channels = computed(() => props.data.config.valueChannels ?? []);
const iterCount = computed(() => run.current?.nodeResults[props.id]?.iterations?.length ?? 0);

function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div class="node-shell group w-[260px] bg-[#25272d] border border-[#16181c] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base" :data-status="status">
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#7aff8a] flex-shrink-0" title="loop controller" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Loop Controller</div>
        <div class="text-text-dim text-[10px] font-mono truncate">
          {{ iterCount > 0 ? `iter ${iterCount} / ${data.config.maxIterations}` : `max ${data.config.maxIterations}` }}
        </div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>
    <div class="py-1">
      <div v-for="ch in channels" :key="ch.name" class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">default-{{ ch.name }}</span>
        <Handle :id="`default-${ch.name}`" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
        <span class="text-text-dim font-mono text-[10px]">output-{{ ch.name }}</span>
        <Handle :id="`output-${ch.name}`" type="source" :position="Position.Right" :style="{ background: colorForType('json') }" />
      </div>
      <div v-for="ch in channels" :key="`back-${ch.name}`" class="relative h-6 flex items-center px-3 text-[11px]">
        <Handle :id="`input-${ch.name}`" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
        <span class="text-text-dim font-mono text-[10px]">input-{{ ch.name }}</span>
      </div>
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">continue</span>
        <Handle id="continue" type="target" :position="Position.Left" :style="{ background: colorForType('json') }" />
        <span class="text-text-dim font-mono text-[10px]">iteration</span>
        <Handle id="iteration" type="source" :position="Position.Right" :style="{ background: colorForType('string') }" />
      </div>
    </div>
  </div>
</template>
