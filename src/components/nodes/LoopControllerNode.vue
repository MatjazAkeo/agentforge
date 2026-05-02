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
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return '#16181c';
  }
});
const channels = computed(() => props.data.config.valueChannels ?? []);
const result = computed(() => run.current?.nodeResults[props.id]);
const iterCount = computed(() => result.value?.iterations?.length ?? 0);
const stopReason = computed(() => result.value?.details?.stopReason as string | undefined);

const subtitle = computed(() => {
  if (status.value === 'running' || status.value === 'streaming') {
    return `iter ${iterCount.value} / ${props.data.config.maxIterations}`;
  }
  if (iterCount.value > 0 && stopReason.value) {
    return `${iterCount.value} iter · ${stopReason.value}`;
  }
  return `max ${props.data.config.maxIterations}`;
});

function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div
    class="node-shell group w-[280px] bg-[#25272d] border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base"
    :style="{ borderColor }"
    :data-status="status"
  >
    <!-- Title bar -->
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-[#16181c]">
      <span class="w-2 h-2 rounded-full bg-[#7aff8a] flex-shrink-0" title="loop controller" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Loop Controller ↺</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ subtitle }}</div>
      </div>
      <button
        type="button"
        @click.stop="onDelete"
        title="Delete node"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none"
      >×</button>
    </div>

    <!-- Empty state -->
    <div v-if="channels.length === 0" class="px-3 py-2 text-[11px] text-text-dim italic opacity-60">
      No channels declared. Open the inspector to add one.
    </div>

    <!-- Per-channel subsection. Each channel is its own boxed group with default + input on
         the left (input marked with ↺ + dashed accent) and output on the right, vertically
         centered between the two left rows so the wire visually represents "channel out". -->
    <div
      v-for="ch in channels"
      :key="ch.name"
      class="relative mx-2 my-2 border border-[#1d1f23] rounded-sm bg-[#1d1f23]/30"
    >
      <div class="px-2 py-0.5 bg-[#1d1f23] text-[10px] font-mono opacity-80 border-b border-[#16181c]">
        {{ ch.name }}
      </div>

      <!-- Default (initial value, fires on iter 1) -->
      <div class="relative h-6 flex items-center pl-3 text-[11px]">
        <Handle
          :id="`default-${ch.name}`"
          type="target"
          :position="Position.Left"
          :style="{ background: colorForType(ch.type ?? 'json') }"
        />
        <span class="text-text-dim font-mono text-[10px]">default</span>
      </div>

      <!-- Back-edge input (cycles in from body, ↺ glyph + dashed left accent) -->
      <div
        class="relative h-6 flex items-center pl-3 text-[11px] border-l-2 border-dashed border-[#7aff8a]/40"
        title="back-edge: cycles in from the loop body"
      >
        <Handle
          :id="`input-${ch.name}`"
          type="target"
          :position="Position.Left"
          :style="{ background: colorForType(ch.type ?? 'json') }"
        />
        <span class="text-text-dim font-mono text-[10px]">↺ input</span>
      </div>

      <!-- Output, vertically centered against the channel-box -->
      <div class="absolute top-1/2 right-0 -translate-y-1/2 flex items-center pr-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">output</span>
        <Handle
          :id="`output-${ch.name}`"
          type="source"
          :position="Position.Right"
          :style="{ background: colorForType(ch.type ?? 'json') }"
        />
      </div>
    </div>

    <!-- Halt strip — visually distinct from channel rows. continue (in) on the left,
         iteration counter (out) on the right. -->
    <div class="rounded-b-md border-t border-[#16181c] bg-[#16181c]">
      <div class="relative h-7 flex items-center justify-between px-3 text-[11px]">
        <div class="flex items-center gap-1.5">
          <Handle
            id="continue"
            type="target"
            :position="Position.Left"
            :style="{ background: colorForType('json') }"
          />
          <span class="text-[#ff5577] text-xs leading-none" title="halt control">⊘</span>
          <span class="text-text-dim font-mono text-[10px]">continue</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-text-dim font-mono text-[10px]">iteration</span>
          <Handle
            id="iteration"
            type="source"
            :position="Position.Right"
            :style="{ background: colorForType('string') }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
