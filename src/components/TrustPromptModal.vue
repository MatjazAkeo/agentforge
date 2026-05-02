<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div
    v-if="ui.trustPromptOpen"
    class="fixed inset-0 bg-black/60 z-[2500] flex items-center justify-center"
    @click.self="ui.resolveTrust('reject')"
  >
    <div class="w-[480px] max-w-[90vw] bg-panel border border-border-strong rounded-lg p-5">
      <h2 class="text-base font-semibold mb-2">Custom code detected</h2>
      <p class="text-sm text-text-dim mb-3">
        This graph contains user-authored JavaScript inside Tool nodes. The code will run in a sandboxed Web Worker if you allow it. Only allow if you trust the source.
      </p>
      <div v-if="ui.trustGraphPath" class="font-mono text-[11px] opacity-60 mb-4 truncate">{{ ui.trustGraphPath }}</div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded bg-elev border border-border-strong text-sm cursor-pointer"
          @click="ui.resolveTrust('reject')"
        >Don't allow</button>
        <button
          type="button"
          class="px-3 py-1.5 rounded bg-accent text-white border border-accent text-sm cursor-pointer font-semibold"
          @click="ui.resolveTrust('allow')"
        >Run anyway</button>
      </div>
    </div>
  </div>
</template>
