<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import { DEFAULT_MODELS } from '@/config/default-models';
import { modelOptionsForDropdown } from '@/config/virtual-models';
import type { AgentConfig } from '@/domain/node-types';
import IterationTree from './IterationTree.vue';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();
const settings = useSettingsStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as AgentConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);
const modelOptions = computed(() =>
  modelOptionsForDropdown(settings.models.length > 0 ? settings.models : DEFAULT_MODELS),
);

function update<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}

// IterationRecord[] is populated by agent.ts via ctx.onIterationComplete — same shape
// as Loop Controller body nodes, so the shared IterationTree renders real per-iteration
// inputs (messages going in) and outputs (assistant text + toolCalls + toolResults).
const iterations = computed(() => result.value?.iterations ?? []);
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Model
      <select :value="cfg.model" @change="(e) => update('model', (e.target as HTMLSelectElement).value)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui">
        <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.displayName }}</option>
      </select>
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      System prompt
      <textarea :value="cfg.systemPrompt" @input="(e) => update('systemPrompt', (e.target as HTMLTextAreaElement).value)"
        rows="3" class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui resize-y"></textarea>
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Temperature
      <input type="number" min="0" max="2" step="0.1" :value="cfg.temperature"
        @input="(e) => update('temperature', parseFloat((e.target as HTMLInputElement).value))"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui">
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Max iterations
      <input type="number" min="1" :value="cfg.maxIterations"
        @input="(e) => update('maxIterations', parseInt((e.target as HTMLInputElement).value, 10) || 25)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui">
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Image port
      <select
        :value="cfg.imagesPortMode ?? 'auto'"
        @change="(e) => update('imagesPortMode', (e.target as HTMLSelectElement).value as AgentConfig['imagesPortMode'])"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
      >
        <option value="auto">Auto (catalog)</option>
        <option value="force-on">On</option>
        <option value="force-off">Off</option>
      </select>
    </label>

    <section v-if="result?.details?.stopReason">
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1">Stop reason</div>
      <div class="text-xs font-mono">{{ result.details.stopReason }}</div>
    </section>

    <section>
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1">Iterations</div>
      <IterationTree :iterations="iterations" />
    </section>

    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[
        { id: 'text', type: 'string', description: 'Initial user prompt for the agent.' },
        { id: 'messages', type: 'messages', description: 'Existing conversation to continue.' },
        { id: 'tools', type: 'tools', description: 'Tools the agent may call. Wire from a Tool Group. Visible only when the selected model supports tools.' },
        { id: 'images', type: 'images', description: 'Image inputs (ImageRef[]) for the initial user message. Port visibility tracks the selected model.' },
      ]"
      :outputs="[
        { id: 'text', type: 'string', description: 'Final assistant text after the loop terminates.' },
        { id: 'messages', type: 'messages', description: 'Full conversation including tool turns.' },
        { id: 'iteration', type: 'number', description: 'Number of iterations the agent ran.' },
      ]"
    />
  </div>
</template>
