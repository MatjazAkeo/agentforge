<script setup lang="ts">
defineProps<{ open: boolean; targetModel: string; edgeCount: number }>();
defineEmits<{ cancel: []; confirm: [] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-panel-strong border border-border-strong rounded-md p-5 max-w-md w-[90%] shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
      <h3 class="text-text-base font-medium text-sm mb-2">Disconnect image edge?</h3>
      <p class="text-text-dim text-xs leading-relaxed mb-4">
        Switching to <strong>{{ targetModel }}</strong> will disconnect
        {{ edgeCount }} image edge<span v-if="edgeCount !== 1">s</span>. Continue?
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          data-testid="mcw-cancel"
          class="px-3 py-1 text-xs border border-border-base rounded bg-elev hover:bg-elev/70"
          @click="$emit('cancel')"
        >Cancel</button>
        <button
          type="button"
          data-testid="mcw-confirm"
          class="px-3 py-1 text-xs border border-error rounded bg-error/15 text-error hover:bg-error/25"
          @click="$emit('confirm')"
        >Continue &amp; Disconnect</button>
      </div>
    </div>
  </div>
</template>
