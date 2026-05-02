<script setup lang="ts">
import { ref } from 'vue';
import { saveApiKey } from '@/secrets/api-key';
import { useSettingsStore } from '@/stores/settings';

const emit = defineEmits<{ done: [] }>();
const settings = useSettingsStore();
const step = ref(1);
const key = ref('');
const saving = ref(false);

async function next() {
  if (step.value === 2) {
    if (key.value.trim()) {
      saving.value = true;
      try {
        await saveApiKey(key.value.trim());
        settings.setApiKey(key.value.trim());
      } finally {
        saving.value = false;
      }
    }
  }
  step.value++;
}
function skip() { emit('done'); }
function finish() { emit('done'); }
</script>

<template>
  <div class="overlay">
    <div class="welcome">
      <div class="icon">🧪</div>
      <h2>Welcome to Agent Playground</h2>
      <p class="subtitle">Let's get you set up in under a minute.</p>
      <div class="steps">
        <div :class="['dot', { active: step >= 1 }]">1</div>
        <div :class="['dot', { active: step >= 2 }]">2</div>
        <div :class="['dot', { active: step >= 3 }]">3</div>
      </div>

      <section v-if="step === 1">
        <h3>What is this?</h3>
        <p>A node-based playground for building, running, and inspecting AI agents. Wire prompts, tools, and LLM calls visually; see exactly what happens at every step.</p>
        <button class="btn-primary" @click="next">Next →</button>
      </section>

      <section v-else-if="step === 2">
        <h3>Add your OpenRouter API key</h3>
        <p>Free models cost nothing.<br><a href="https://openrouter.ai/" target="_blank">Sign up at OpenRouter (1 minute) →</a></p>
        <input v-model="key" placeholder="sk-or-v1-…" type="password">
        <div class="row">
          <button class="btn" @click="skip">Skip — I'll add later</button>
          <button class="btn-primary" :disabled="saving || !key.trim()" @click="next">{{ saving ? 'Saving…' : 'Next →' }}</button>
        </div>
      </section>

      <section v-else>
        <h3>You're all set</h3>
        <p>Templates and a starter graph come in a later release. For now, click + on the canvas to add your first node.</p>
        <button class="btn-primary" @click="finish">Get started</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: var(--bg-canvas); display: flex; align-items: center; justify-content: center; z-index: 3000; }
.welcome { width: 480px; max-width: 90vw; padding: 28px; background: var(--bg-panel); border: 1px solid var(--border-strong); border-radius: 10px; text-align: center; }
.icon { font-size: 36px; margin-bottom: 8px; }
h2 { margin: 0 0 4px; }
.subtitle { opacity: 0.7; font-size: 12px; margin: 0 0 16px; }
.steps { display: flex; justify-content: center; gap: 12px; margin-bottom: 20px; }
.dot { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-elev); color: var(--text-dim); display: flex; align-items: center; justify-content: center; font-size: 12px; }
.dot.active { background: var(--accent); color: white; }
section { display: flex; flex-direction: column; gap: 10px; align-items: center; }
section h3 { margin: 4px 0 0; }
section p { font-size: 13px; opacity: 0.85; margin: 0; }
input { width: 80%; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 6px 10px; font-size: 13px; }
.row { display: flex; gap: 8px; }
.btn, .btn-primary { padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; border: 1px solid var(--border-strong); background: var(--bg-elev); color: var(--text); }
.btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
a { color: var(--accent); }
</style>
