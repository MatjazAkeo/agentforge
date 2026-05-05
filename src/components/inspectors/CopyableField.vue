<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  /** Field label (handle name, "inputs", "output", etc.) */
  label: string;
  /** Pre-formatted text content. Click anywhere on the card to copy this. */
  value: string;
  /** Optional: cap height of the body block. Defaults to 160px to match the
   *  existing I/O / iter cards. */
  maxHeight?: string;
}>();

const copied = ref(false);
let timer: number | undefined;

async function onClick() {
  try {
    await navigator.clipboard.writeText(props.value);
    copied.value = true;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => { copied.value = false; }, 1200);
  } catch {
    // Clipboard might be blocked in some contexts; degrade silently.
  }
}
</script>

<template>
  <div
    class="bg-node-inset rounded cursor-pointer hover:ring-1 hover:ring-accent/40 transition"
    :title="copied ? 'Copied to clipboard' : 'Click to copy'"
    @click="onClick"
  >
    <div class="flex items-center justify-between px-2 py-1 text-[10px] font-mono">
      <span class="opacity-60 truncate">{{ label }}</span>
      <span class="opacity-60 ml-2 shrink-0">
        <span v-if="copied" class="text-success">copied ✓</span>
        <span v-else>⧉</span>
      </span>
    </div>
    <pre
      class="px-2 pb-1.5 text-[11px] whitespace-pre-wrap m-0 overflow-auto"
      :style="{ maxHeight: maxHeight ?? '160px' }"
    >{{ value }}</pre>
  </div>
</template>
