<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useRunStore } from '@/stores/run';
import { useSettingsStore } from '@/stores/settings';
import type { LLMCallConfig } from '@/domain/node-types';
import { DEFAULT_MODELS } from '@/config/default-models';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();
const run = useRunStore();
const settings = useSettingsStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as LLMCallConfig | null);
const result = computed(() => run.current?.nodeResults[props.nodeId]);

const sectionsOpen = ref({
  config: true, conversation: true, stats: true,
  request: false, response: false, errors: false,
});

const modelOptions = computed(() =>
  settings.models.length > 0 ? settings.models : DEFAULT_MODELS,
);

function update<K extends keyof LLMCallConfig>(key: K, value: LLMCallConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}
function toggle(k: keyof typeof sectionsOpen.value) { sectionsOpen.value[k] = !sectionsOpen.value[k]; }

const messages = computed(() => {
  const req = result.value?.details?.request as { messages?: Array<{ role: string; content: string }> } | undefined;
  return req?.messages ?? [];
});
const usage = computed(() => result.value?.details?.usage as { input: number; output: number } | undefined);
const timing = computed(() => result.value?.details?.timing as { totalMs: number; firstTokenMs: number | null } | undefined);
const responseText = computed(() => {
  const r = result.value?.details?.response as { text?: string } | undefined;
  return r?.text ?? '';
});
const requestJson = computed(() =>
  result.value?.details?.request ? JSON.stringify(result.value.details.request, null, 2) : '—',
);
const responseJson = computed(() =>
  result.value?.details?.response ? JSON.stringify(result.value.details.response, null, 2) : '—',
);
</script>

<template>
  <div v-if="cfg">
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
            @change="(e) => update('model', (e.target as HTMLSelectElement).value)"
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
