<script setup lang="ts">
// A 4-px-wide drag handle absolutely positioned inside a sidebar's right
// (side='left') or left (side='right') edge. Calls onResize(delta) on each
// pointer move while the user drags. Adds a class to body during drag so
// other handlers (Vue Flow, text selection) don't fight the resize.
const props = defineProps<{
  side: 'left' | 'right';
  onResize: (deltaX: number) => void;
}>();

let lastX = 0;
let dragging = false;

function onMouseMove(e: MouseEvent) {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  // For a left sidebar, dragging right (positive dx) widens it; for the
  // right sidebar, dragging right narrows it — flip the sign.
  props.onResize(props.side === 'left' ? dx : -dx);
}

function onMouseUp() {
  dragging = false;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  document.body.classList.remove('cursor-ew-resize', 'select-none');
}

function onMouseDown(e: MouseEvent) {
  e.preventDefault();
  dragging = true;
  lastX = e.clientX;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  document.body.classList.add('cursor-ew-resize', 'select-none');
}
</script>

<template>
  <div
    @mousedown="onMouseDown"
    :class="[
      'absolute top-0 bottom-0 w-1 cursor-ew-resize z-10 transition-colors hover:bg-accent/40',
      side === 'left' ? 'right-0' : 'left-0',
    ]"
    role="separator"
    :aria-orientation="'vertical'"
    :aria-label="side === 'left' ? 'Resize left sidebar' : 'Resize right sidebar'"
  />
</template>
