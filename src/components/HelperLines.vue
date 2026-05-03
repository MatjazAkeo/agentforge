<script setup lang="ts">
import { computed } from 'vue';

/**
 * Renders alignment guide lines on the canvas while a node is being dragged.
 * Coordinates arrive in flow-space; this component projects them to screen-space
 * via the current viewport transform (translate + zoom) so the lines stay
 * locked to the right pixels even when the canvas is panned/zoomed.
 */
const props = defineProps<{
  verticalX: number | null;
  horizontalY: number | null;
  viewport: { x: number; y: number; zoom: number };
}>();

const screenVx = computed(() => {
  if (props.verticalX === null) return null;
  return props.verticalX * props.viewport.zoom + props.viewport.x;
});
const screenHy = computed(() => {
  if (props.horizontalY === null) return null;
  return props.horizontalY * props.viewport.zoom + props.viewport.y;
});
</script>

<template>
  <div class="absolute inset-0 pointer-events-none z-[5]">
    <div
      v-if="screenVx !== null"
      class="absolute top-0 bottom-0 w-px bg-accent/80"
      :style="{ left: `${screenVx}px` }"
    />
    <div
      v-if="screenHy !== null"
      class="absolute left-0 right-0 h-px bg-accent/80"
      :style="{ top: `${screenHy}px` }"
    />
  </div>
</template>
