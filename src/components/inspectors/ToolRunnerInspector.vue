<script setup lang="ts">
import { computed } from 'vue';
import { useRunStore } from '@/stores/run';
import PortLegend from './PortLegend.vue';
import IOValues from './IOValues.vue';

interface ToolRunResult {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  durationMs: number;
}

const props = defineProps<{ nodeId: string }>();
const run = useRunStore();

const result = computed(() => run.current?.nodeResults[props.nodeId]);
const results = computed(() =>
  (result.value?.details?.results as ToolRunResult[] | undefined) ?? [],
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="text-[10px] uppercase opacity-60 font-mono">Last run results</div>
    <div v-if="results.length === 0" class="text-xs opacity-50 italic">— no run yet —</div>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="r in results" :key="r.toolCallId" class="bg-panel rounded px-2 py-2 text-xs">
        <div class="flex items-center justify-between mb-1">
          <span class="font-mono">{{ r.name }}</span>
          <span class="opacity-50 text-[10px]">{{ r.durationMs.toFixed(0) }}ms</span>
        </div>
        <div class="opacity-60 text-[11px] mb-1">
          <span class="font-mono opacity-80">input:</span>
          <pre class="m-0 mt-0.5 whitespace-pre-wrap font-mono text-[11px]">{{ JSON.stringify(r.input, null, 2) }}</pre>
        </div>
        <div v-if="r.error" class="text-[#f5a5a5] text-[11px]">
          <span class="font-mono opacity-80">error:</span> {{ r.error }}
        </div>
        <div v-else class="opacity-60 text-[11px]">
          <span class="font-mono opacity-80">output:</span>
          <pre class="m-0 mt-0.5 whitespace-pre-wrap font-mono text-[11px]">{{ typeof r.output === 'string' ? r.output : JSON.stringify(r.output, null, 2) }}</pre>
        </div>
      </li>
    </ul>

    <IOValues :node-id="nodeId" />

    <PortLegend
      :inputs="[
        { id: 'tools', type: 'tools', description: 'Tool definitions used to look up and execute each call.' },
        { id: 'messages', type: 'messages', description: 'Conversation so far. Tool-result messages are appended.' },
        { id: 'toolCalls', type: 'tool-calls', description: 'Tool invocations from an LLM Call to execute.' },
      ]"
      :outputs="[
        { id: 'messages', type: 'messages', description: 'Conversation with `tool` role results appended — feed back to LLM Call.' },
        { id: 'results', type: 'json', description: 'Raw structured results (name, input, output/error, durationMs).' },
      ]"
    />
  </div>
</template>
