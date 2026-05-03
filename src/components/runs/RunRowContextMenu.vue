<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

defineProps<{
  x: number;
  y: number;
}>();
const emit = defineEmits<{
  delete: [];
  reveal: [];
  close: [];
}>();

function onDocClick() { emit('close'); }
function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') emit('close'); }

onMounted(() => {
  // Defer one frame so the contextmenu's own click doesn't immediately close us.
  requestAnimationFrame(() => {
    document.addEventListener('click', onDocClick, { once: true });
    document.addEventListener('keydown', onEsc);
  });
});
onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onEsc);
});
</script>

<template>
  <div
    class="fixed z-[3000] min-w-[180px] py-1 bg-panel-strong border border-border-strong rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.5)] text-xs"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
  >
    <button
      type="button"
      class="block w-full text-left px-3 py-1.5 cursor-pointer hover:bg-elev"
      @click="emit('reveal'); emit('close')"
    >Reveal in Finder</button>
    <button
      type="button"
      class="block w-full text-left px-3 py-1.5 cursor-pointer text-error hover:bg-error/15"
      @click="emit('delete'); emit('close')"
    >Delete</button>
  </div>
</template>
