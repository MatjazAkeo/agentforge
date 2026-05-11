<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import type { LLMCallConfig } from '@/domain/node-types';
import { DEFAULT_MODELS } from '@/config/default-models';
import { modelOptionsForDropdown } from '@/config/virtual-models';
import PortLegend from './PortLegend.vue';
import IOValues from './IOValues.vue';
import ModelChangeWarning from './llm-call/ModelChangeWarning.vue';
import { resolveImagesPortVisibility, type ImagesPortMode } from '@/openrouter/vision';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();
const settings = useSettingsStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as LLMCallConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);

// JSON mode dropdown visibility tracks the selected model's catalog capability.
// Unknown models default to shown so custom IDs aren't stripped of the control
// just because the catalog hasn't indexed them yet.
const showJsonMode = computed(() => {
  const m = settings.models.find((x) => x.id === cfg.value?.model);
  if (!m) return true;
  return m.supportsJsonMode;
});

const sectionsOpen = ref({
  config: true, conversation: true, stats: true,
  request: false, response: false, errors: false,
});

const selectedIter = ref<number | null>(null);

interface PendingChange {
  targetModel: string;
  targetMode: ImagesPortMode;
  edgeCount: number;
  apply: () => void;
}
const pendingChange = ref<PendingChange | null>(null);

const modelOptions = computed(() =>
  modelOptionsForDropdown(settings.models.length > 0 ? settings.models : DEFAULT_MODELS),
);

function update<K extends keyof LLMCallConfig>(key: K, value: LLMCallConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
function toggle(k: keyof typeof sectionsOpen.value) { sectionsOpen.value[k] = !sectionsOpen.value[k]; }

function imageEdgeCount(): number {
  return graph.edges.filter(
    (e) => e.target === props.nodeId && e.targetHandle === 'images',
  ).length;
}

function visibleAfter(targetModel: string, targetMode: ImagesPortMode): boolean {
  return resolveImagesPortVisibility(targetMode, targetModel, settings.models);
}

function attemptChange(targetModel: string, targetMode: ImagesPortMode, applyFn: () => void) {
  const count = imageEdgeCount();
  const currentlyVisible = resolveImagesPortVisibility(
    (cfg.value?.imagesPortMode ?? 'auto') as ImagesPortMode,
    cfg.value?.model ?? '',
    settings.models,
  );
  const willBeVisible = visibleAfter(targetModel, targetMode);
  if (count > 0 && currentlyVisible && !willBeVisible) {
    pendingChange.value = { targetModel, targetMode, edgeCount: count, apply: applyFn };
  } else {
    applyFn();
  }
}

function onModelChange(newModel: string) {
  attemptChange(
    newModel,
    (cfg.value?.imagesPortMode ?? 'auto') as ImagesPortMode,
    () => graph.updateNodeConfig(props.nodeId, { model: newModel }),
  );
}

function onPortModeChange(newMode: ImagesPortMode) {
  attemptChange(
    cfg.value?.model ?? '',
    newMode,
    () => graph.updateNodeConfig(props.nodeId, { imagesPortMode: newMode }),
  );
}

function onCancelChange() { pendingChange.value = null; }

function onConfirmChange() {
  const pc = pendingChange.value;
  if (!pc) return;
  graph.edges
    .filter((e) => e.target === props.nodeId && e.targetHandle === 'images')
    .forEach((e) => graph.removeEdge(e.id));
  pc.apply();
  pendingChange.value = null;
}

const iterRecords = computed(() => result.value?.iterations ?? []);
const selectedRecord = computed(() => {
  if (iterRecords.value.length === 0) return null;
  const idx = selectedIter.value ?? iterRecords.value.length;
  return iterRecords.value.find((r) => r.iteration === idx) ?? iterRecords.value[iterRecords.value.length - 1];
});

const messages = computed(() => {
  const src = selectedRecord.value?.details ?? result.value?.details;
  const req = (src as { request?: { messages?: Array<{ role: string; content: string }> } } | undefined)?.request;
  return req?.messages ?? [];
});
const usage = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { usage?: { input: number; output: number } } | undefined;
  return src?.usage;
});
const timing = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { timing?: { totalMs: number; firstTokenMs: number | null } } | undefined;
  return src?.timing;
});
const responseText = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { response?: { text?: string } } | undefined;
  return src?.response?.text ?? '';
});
const requestJson = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { request?: unknown } | undefined;
  return src?.request ? JSON.stringify(src.request, null, 2) : '—';
});
const responseJson = computed(() => {
  const src = (selectedRecord.value?.details ?? result.value?.details) as { response?: unknown } | undefined;
  return src?.response ? JSON.stringify(src.response, null, 2) : '—';
});
</script>

<template>
  <div v-if="cfg">
    <ModelChangeWarning
      :open="pendingChange !== null"
      :target-model="pendingChange?.targetModel ?? ''"
      :edge-count="pendingChange?.edgeCount ?? 0"
      @cancel="onCancelChange"
      @confirm="onConfirmChange"
    />

    <div v-if="iterRecords.length > 1" class="flex items-center gap-2 mb-2 text-xs">
      <span class="opacity-60">iteration</span>
      <select :value="selectedIter ?? iterRecords[iterRecords.length - 1].iteration"
        @change="(e) => selectedIter = parseInt((e.target as HTMLSelectElement).value, 10)"
        class="bg-elev text-text-base border border-border-base rounded px-1 py-0.5">
        <option v-for="r in iterRecords" :key="r.iteration" :value="r.iteration">{{ r.iteration }}</option>
      </select>
    </div>

    <!-- Config -->
    <section class="border-t border-border-base first:border-t-0">
      <h4
        @click="toggle('config')"
        class="m-0 py-2.5 text-sm cursor-pointer select-none"
      >{{ sectionsOpen.config ? '▼' : '▶' }} Config</h4>
      <div v-show="sectionsOpen.config" class="flex flex-col gap-2.5 pt-1 pb-3">
        <label class="flex flex-col gap-1 text-xs opacity-85">
          Model
          <select
            :value="cfg.model"
            @change="(e) => onModelChange((e.target as HTMLSelectElement).value)"
            class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
          >
            <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.displayName }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs opacity-85">
          System prompt
          <textarea
            :value="cfg.systemPrompt"
            @input="(e) => update('systemPrompt', (e.target as HTMLTextAreaElement).value)"
            rows="3"
            class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui resize-y"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1 text-xs opacity-85">
          Temperature
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            :value="cfg.temperature"
            @input="(e) => update('temperature', parseFloat((e.target as HTMLInputElement).value))"
            class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
          >
        </label>
        <label v-if="showJsonMode" class="flex flex-col gap-1 text-xs opacity-85">
          Response format
          <select
            :value="cfg.responseFormat ?? 'null'"
            @change="(e) => update('responseFormat', ((e.target as HTMLSelectElement).value === 'null' ? null : 'json_object') as LLMCallConfig['responseFormat'])"
            class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
          >
            <option value="null">Free-form text (default)</option>
            <option value="json_object">JSON object</option>
          </select>
          <span class="text-text-dim text-[10px] leading-snug">
            JSON mode constrains output to be parseable JSON.
          </span>
        </label>
        <label class="flex flex-col gap-1 text-xs opacity-85">
          Image port
          <select
            :value="cfg.imagesPortMode ?? 'auto'"
            @change="(e) => onPortModeChange((e.target as HTMLSelectElement).value as ImagesPortMode)"
            class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
          >
            <option value="auto">Auto (catalog)</option>
            <option value="force-on">On</option>
            <option value="force-off">Off</option>
          </select>
        </label>
      </div>
    </section>

    <!-- Conversation -->
    <section class="border-t border-border-base">
      <h4
        @click="toggle('conversation')"
        class="m-0 py-2.5 text-sm cursor-pointer select-none"
      >{{ sectionsOpen.conversation ? '▼' : '▶' }} Conversation</h4>
      <div v-show="sectionsOpen.conversation" class="pb-3">
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="my-1.5 px-2 py-1.5 bg-panel rounded"
          :data-role="m.role"
        >
          <div class="text-[11px] opacity-50 uppercase mb-1">{{ m.role }}</div>
          <pre class="m-0 whitespace-pre-wrap text-xs">{{ m.content }}</pre>
        </div>
        <div v-if="result?.details?.response" class="my-1.5 px-2 py-1.5 bg-panel rounded">
          <div class="text-[11px] opacity-50 uppercase mb-1">assistant</div>
          <pre class="m-0 whitespace-pre-wrap text-xs text-[#b8d8ff]">{{ responseText }}</pre>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="border-t border-border-base">
      <h4
        @click="toggle('stats')"
        class="m-0 py-2.5 text-sm cursor-pointer select-none"
      >{{ sectionsOpen.stats ? '▼' : '▶' }} Stats</h4>
      <div v-show="sectionsOpen.stats" class="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-1 pb-3 text-xs">
        <div>tokens in: <strong>{{ usage?.input ?? '—' }}</strong></div>
        <div>tokens out: <strong>{{ usage?.output ?? '—' }}</strong></div>
        <div>total time: <strong>{{ timing ? `${(timing.totalMs / 1000).toFixed(2)}s` : '—' }}</strong></div>
        <div>first token: <strong>{{ timing?.firstTokenMs !== null && timing?.firstTokenMs !== undefined ? `${Math.round(timing.firstTokenMs)}ms` : '—' }}</strong></div>
      </div>
    </section>

    <!-- Raw request -->
    <section class="border-t border-border-base">
      <h4
        @click="toggle('request')"
        class="m-0 py-2.5 text-sm cursor-pointer select-none"
      >{{ sectionsOpen.request ? '▼' : '▶' }} Raw request</h4>
      <pre
        v-show="sectionsOpen.request"
        class="bg-panel px-2 py-1.5 rounded text-xs max-h-[200px] overflow-auto whitespace-pre-wrap m-0"
      >{{ requestJson }}</pre>
    </section>

    <!-- Raw response -->
    <section class="border-t border-border-base">
      <h4
        @click="toggle('response')"
        class="m-0 py-2.5 text-sm cursor-pointer select-none"
      >{{ sectionsOpen.response ? '▼' : '▶' }} Raw response</h4>
      <pre
        v-show="sectionsOpen.response"
        class="bg-panel px-2 py-1.5 rounded text-xs max-h-[200px] overflow-auto whitespace-pre-wrap m-0"
      >{{ responseJson }}</pre>
    </section>

    <IOValues :node-id="nodeId" />

    <PortLegend
      :inputs="[
        { id: 'text', type: 'string', description: 'Single user prompt. Becomes a `user` message before the call.' },
        { id: 'messages', type: 'messages', description: 'Existing conversation history to continue. Combined with `text` if no upstream messages.' },
        { id: 'tools', type: 'tools', description: 'Tool definitions the model may call. Wire from Tool or Tool Group.' },
        { id: 'images', type: 'images', description: 'Image inputs (ImageRef[]) for vision-capable models. Port visibility tracks the selected model.' },
      ]"
      :outputs="[
        { id: 'text', type: 'string', description: 'Assistant\'s text reply (final or partial when tool-calling).' },
        { id: 'messages', type: 'messages', description: 'Full conversation including the assistant reply — feed back for next turn.' },
        { id: 'toolCalls', type: 'tool-calls', description: 'Tool invocations emitted by the model. Wire to a Tool Runner.' },
      ]"
    />

    <!-- Error -->
    <section v-if="result?.errorMessage" class="border-t border-border-base">
      <h4
        @click="toggle('errors')"
        class="m-0 py-2.5 text-sm cursor-pointer select-none text-error"
      >{{ sectionsOpen.errors ? '▼' : '▶' }} Error</h4>
      <pre
        v-show="sectionsOpen.errors"
        class="bg-panel px-2 py-1.5 rounded text-xs max-h-[200px] overflow-auto whitespace-pre-wrap m-0 text-[#f5a5a5]"
      >{{ result.errorMessage }}{{ result.errorStack ? '\n\n' + result.errorStack : '' }}</pre>
    </section>
  </div>
</template>
