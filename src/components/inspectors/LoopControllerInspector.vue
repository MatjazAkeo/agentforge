<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import type { LoopControllerConfig, LoopChannelType } from '@/domain/node-types';
import IterationTree from './IterationTree.vue';
import IOValues from './IOValues.vue';
import PortLegend from './PortLegend.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as LoopControllerConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);

function update<K extends keyof LoopControllerConfig>(key: K, value: LoopControllerConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}

function addChannel() {
  const existing = cfg.value?.valueChannels ?? [];
  update('valueChannels', [...existing, { name: `channel${existing.length + 1}`, type: 'json' as LoopChannelType }]);
}
function renameChannel(i: number, name: string) {
  const next = [...(cfg.value?.valueChannels ?? [])];
  next[i] = { ...next[i], name };
  update('valueChannels', next);
}
function retypeChannel(i: number, type: LoopChannelType) {
  const next = [...(cfg.value?.valueChannels ?? [])];
  next[i] = { ...next[i], type };
  update('valueChannels', next);
}
function removeChannel(i: number) {
  const next = [...(cfg.value?.valueChannels ?? [])];
  next.splice(i, 1);
  update('valueChannels', next);
}
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Max iterations
      <input type="number" min="1" :value="cfg.maxIterations"
        @input="(e) => update('maxIterations', parseInt((e.target as HTMLInputElement).value, 10) || 25)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui">
    </label>

    <section>
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1.5 flex items-center justify-between">
        <span>Channels ({{ cfg.valueChannels.length }})</span>
        <button type="button" @click="addChannel" class="text-text-dim hover:text-text-base text-[11px]">+ add</button>
      </div>
      <ul class="flex flex-col gap-2">
        <li v-for="(c, i) in cfg.valueChannels" :key="i" class="flex flex-col gap-1">
          <div class="flex items-center gap-1.5">
            <input :value="c.name" @input="(e) => renameChannel(i, (e.target as HTMLInputElement).value)"
              class="bg-elev text-text-base border border-border-base rounded px-2 py-1 text-xs font-mono flex-1 min-w-0">
            <button type="button" @click="removeChannel(i)" class="text-text-dim hover:text-error text-xs flex-shrink-0">×</button>
          </div>
          <select :value="c.type ?? 'json'"
            @change="(e) => retypeChannel(i, (e.target as HTMLSelectElement).value as LoopChannelType)"
            class="bg-elev text-text-base border border-border-base rounded px-2 py-1 text-[11px] font-mono w-full"
            title="Channel wire type">
            <option value="json">json (any)</option>
            <option value="string">string</option>
            <option value="messages">messages</option>
            <option value="tools">tools</option>
            <option value="tool-calls">tool-calls</option>
          </select>
        </li>
      </ul>
    </section>

    <section v-if="result?.details?.stopReason">
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1">Stop reason</div>
      <div class="text-xs font-mono">{{ result.details.stopReason }} ({{ result.iterations?.length ?? 0 }} iter)</div>
    </section>

    <section>
      <div class="text-[10px] uppercase opacity-60 font-mono mb-1">Iterations</div>
      <IterationTree :iterations="result?.iterations ?? []" />
    </section>

    <IOValues :node-id="nodeId" />
    <PortLegend
      :inputs="[
        { id: 'default-<name>', type: 'json', description: 'Initial value for each declared channel.' },
        { id: 'input-<name>', type: 'json', description: 'Back-edge value cycling in from the loop body.' },
        { id: 'continue', type: 'json', description: 'Truthy keeps looping; falsy terminates.' },
      ]"
      :outputs="[
        { id: 'output-<name>', type: 'json', description: 'Current channel value per iteration.' },
        { id: 'iteration', type: 'string', description: 'Current 1-based iteration index.' },
      ]"
    />
  </div>
</template>
