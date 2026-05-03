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
  <div class="fixed inset-0 bg-canvas flex items-center justify-center z-[3000]">
    <div class="w-[480px] max-w-[90vw] p-7 bg-panel border border-border-strong rounded-[10px] text-center">
      <div class="text-4xl mb-2">🧪</div>
      <h2 class="m-0 mb-1">Welcome to AgentForge</h2>
      <p class="opacity-70 text-xs m-0 mb-4">Let's get you set up in under a minute.</p>
      <div class="flex justify-center gap-3 mb-5">
        <div :class="['w-7 h-7 rounded-full flex items-center justify-center text-xs', step >= 1 ? 'bg-accent text-white' : 'bg-elev text-text-dim']">1</div>
        <div :class="['w-7 h-7 rounded-full flex items-center justify-center text-xs', step >= 2 ? 'bg-accent text-white' : 'bg-elev text-text-dim']">2</div>
        <div :class="['w-7 h-7 rounded-full flex items-center justify-center text-xs', step >= 3 ? 'bg-accent text-white' : 'bg-elev text-text-dim']">3</div>
      </div>

      <section v-if="step === 1" class="flex flex-col gap-2.5 items-center">
        <h3 class="mt-1 mb-0">What is this?</h3>
        <p class="text-[13px] opacity-85 m-0">
          A node-based playground for building, running, and inspecting AI agents. Wire prompts, tools, and LLM calls visually; see exactly what happens at every step.
        </p>
        <button
          type="button"
          @click="next"
          class="px-3.5 py-1.5 rounded text-xs cursor-pointer border border-accent bg-accent text-white transition"
        >Next →</button>
      </section>

      <section v-else-if="step === 2" class="flex flex-col gap-2.5 items-center">
        <h3 class="mt-1 mb-0">Add your OpenRouter API key</h3>
        <p class="text-[13px] opacity-85 m-0">
          Free models cost nothing.<br>
          <a class="text-accent" href="https://openrouter.ai/" target="_blank">Sign up at OpenRouter (1 minute) →</a>
        </p>
        <input
          v-model="key"
          placeholder="sk-or-v1-…"
          type="password"
          class="w-4/5 bg-elev text-text-base border border-border-base rounded px-2.5 py-1.5 text-[13px]"
        >
        <div class="flex gap-2">
          <button
            type="button"
            @click="skip"
            class="px-3.5 py-1.5 rounded text-xs cursor-pointer border border-border-strong bg-elev text-text-base transition"
          >Skip — I'll add later</button>
          <button
            type="button"
            :disabled="saving || !key.trim()"
            @click="next"
            class="px-3.5 py-1.5 rounded text-xs cursor-pointer border border-accent bg-accent text-white transition disabled:bg-elev disabled:text-text-dim disabled:border-border-strong disabled:cursor-not-allowed disabled:opacity-45"
          >{{ saving ? 'Saving…' : 'Next →' }}</button>
        </div>
      </section>

      <section v-else class="flex flex-col gap-2.5 items-center">
        <h3 class="mt-1 mb-0">You're all set</h3>
        <p class="text-[13px] opacity-85 m-0">
          Templates and a starter graph come in a later release. For now, click + on the canvas to add your first node.
        </p>
        <button
          type="button"
          @click="finish"
          class="px-3.5 py-1.5 rounded text-xs cursor-pointer border border-accent bg-accent text-white transition"
        >Get started</button>
      </section>
    </div>
  </div>
</template>
