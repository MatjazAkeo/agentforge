<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import { colorForType } from '@/nodes/port-types';
import type { AgentConfig } from '@/domain/node-types';

const props = defineProps<{ id: string; data: { config: AgentConfig } }>();
const graph = useGraphStore();
const run = useRunStore();
const settings = useSettingsStore();
const status = computed(() => run.current?.nodeResults[props.id]?.status ?? 'idle');
const borderColor = computed(() => {
  switch (status.value) {
    case 'done': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'running':
    case 'streaming': return 'var(--accent)';
    default: return 'var(--border)';
  }
});
const iterationsRun = computed(() => {
  const iters = run.current?.nodeResults[props.id]?.details?.iterations as Array<unknown> | undefined;
  return iters?.length ?? 0;
});

// Tools port tracks the selected model's catalog supportsTools flag. Unknown
// models default to shown so custom / unlisted IDs aren't stripped of wiring.
const showToolsPort = computed(() => {
  const m = settings.models.find((x) => x.id === props.data.config.model);
  if (!m) return true;
  return m.supportsTools;
});

function onDelete() { graph.removeNode(props.id); }
</script>

<template>
  <div class="node-shell group w-[260px] bg-node border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.45)] font-ui text-text-base" :style="{ borderColor }" :data-status="status">
    <div class="relative rounded-t-md flex items-center gap-2 px-3 py-1.5 border-b border-border-base">
      <span class="w-2 h-2 rounded-full bg-[#7aa2ff] flex-shrink-0" title="agent" />
      <div class="flex-1 min-w-0">
        <div class="text-text-base font-medium text-xs leading-tight">Agent</div>
        <div class="text-text-dim text-[10px] font-mono truncate">{{ data.config.model }}</div>
      </div>
      <button type="button" @click.stop="onDelete" title="Delete"
        class="opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded text-text-dim hover:bg-error/25 hover:text-error flex items-center justify-center text-base leading-none">×</button>
    </div>
    <div class="py-1">
      <div class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">context</span>
        <Handle id="context" type="target" :position="Position.Left" :style="{ background: colorForType('context') }" />
        <span class="text-text-dim font-mono text-[10px]">context</span>
        <Handle id="context" type="source" :position="Position.Right" :style="{ background: colorForType('context') }" />
      </div>
      <div v-if="showToolsPort" class="relative h-6 flex items-center justify-between px-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">tools</span>
        <Handle id="tools" type="target" :position="Position.Left" :style="{ background: colorForType('tools') }" />
        <span class="text-text-dim font-mono text-[10px]">iteration</span>
        <Handle id="iteration" type="source" :position="Position.Right" :style="{ background: colorForType('number') }" />
      </div>
      <!-- iteration output is meaningful even without tools — show it standalone when tools row hidden -->
      <div v-else class="relative h-6 flex items-center justify-end pr-3 text-[11px]">
        <span class="text-text-dim font-mono text-[10px]">iteration</span>
        <Handle id="iteration" type="source" :position="Position.Right" :style="{ background: colorForType('number') }" />
      </div>
    </div>
    <div class="rounded-b-md px-3 py-1.5 text-[10px] opacity-60 border-t border-border-base bg-node-inset text-center">
      <span v-if="iterationsRun > 0">{{ iterationsRun }} iter / {{ data.config.maxIterations }}</span>
      <span v-else class="italic">— not yet run —</span>
    </div>
  </div>
</template>
