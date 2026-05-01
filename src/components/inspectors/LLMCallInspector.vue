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
</script>

<template>
  <div v-if="cfg">
    <section>
      <h4 @click="toggle('config')">{{ sectionsOpen.config ? '▼' : '▶' }} Config</h4>
      <div v-show="sectionsOpen.config" class="form">
        <label>Model
          <select :value="cfg.model" @change="(e) => update('model', (e.target as HTMLSelectElement).value)">
            <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.displayName }}</option>
          </select>
        </label>
        <label>System prompt
          <textarea :value="cfg.systemPrompt" @input="(e) => update('systemPrompt', (e.target as HTMLTextAreaElement).value)" rows="3"></textarea>
        </label>
        <label>Temperature
          <input type="number" min="0" max="2" step="0.1" :value="cfg.temperature" @input="(e) => update('temperature', parseFloat((e.target as HTMLInputElement).value))">
        </label>
      </div>
    </section>

    <section>
      <h4 @click="toggle('conversation')">{{ sectionsOpen.conversation ? '▼' : '▶' }} Conversation</h4>
      <div v-show="sectionsOpen.conversation" class="conversation">
        <div v-for="(m, i) in messages" :key="i" class="msg" :data-role="m.role">
          <div class="role">{{ m.role }}</div>
          <pre>{{ m.content }}</pre>
        </div>
        <div v-if="result?.details?.response" class="msg" data-role="assistant">
          <div class="role">assistant</div>
          <pre>{{ responseText }}</pre>
        </div>
      </div>
    </section>

    <section>
      <h4 @click="toggle('stats')">{{ sectionsOpen.stats ? '▼' : '▶' }} Stats</h4>
      <div v-show="sectionsOpen.stats" class="stats">
        <div>tokens in: <strong>{{ usage?.input ?? '—' }}</strong></div>
        <div>tokens out: <strong>{{ usage?.output ?? '—' }}</strong></div>
        <div>total time: <strong>{{ timing ? `${(timing.totalMs / 1000).toFixed(2)}s` : '—' }}</strong></div>
        <div>first token: <strong>{{ timing?.firstTokenMs !== null && timing?.firstTokenMs !== undefined ? `${Math.round(timing.firstTokenMs)}ms` : '—' }}</strong></div>
      </div>
    </section>

    <section>
      <h4 @click="toggle('request')">{{ sectionsOpen.request ? '▼' : '▶' }} Raw request</h4>
      <pre v-show="sectionsOpen.request" class="raw">{{ result?.details?.request ?? '—' }}</pre>
    </section>

    <section>
      <h4 @click="toggle('response')">{{ sectionsOpen.response ? '▼' : '▶' }} Raw response</h4>
      <pre v-show="sectionsOpen.response" class="raw">{{ result?.details?.response ?? '—' }}</pre>
    </section>

    <section v-if="result?.errorMessage">
      <h4 @click="toggle('errors')" class="error-head">{{ sectionsOpen.errors ? '▼' : '▶' }} Error</h4>
      <pre v-show="sectionsOpen.errors" class="raw error">{{ result.errorMessage }}{{ result.errorStack ? '\n\n' + result.errorStack : '' }}</pre>
    </section>
  </div>
</template>

<style scoped>
section { border-top: 1px solid var(--border); }
section:first-child { border-top: none; }
h4 { margin: 0; padding: 8px 0; font-size: 12px; cursor: pointer; user-select: none; }
.form { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 12px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; opacity: 0.85; }
input, select, textarea { background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 12px; font-family: var(--font-ui); }
.conversation { padding-bottom: 12px; }
.msg { margin: 6px 0; padding: 6px 8px; background: var(--bg-panel); border-radius: 4px; }
.msg .role { font-size: 10px; opacity: 0.5; text-transform: uppercase; margin-bottom: 2px; }
.msg pre { margin: 0; white-space: pre-wrap; font-size: 11px; }
.msg[data-role="assistant"] pre { color: #b8d8ff; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; padding: 4px 0 12px; font-size: 11px; }
.raw { background: var(--bg-panel); padding: 6px 8px; border-radius: 4px; font-size: 11px; max-height: 200px; overflow: auto; white-space: pre-wrap; }
.raw.error { color: #f5a5a5; }
.error-head { color: var(--error); }
</style>
