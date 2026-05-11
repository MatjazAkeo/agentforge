<script setup lang="ts">
import { useChatStore } from '@/stores/chat';

const chat = useChatStore();

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div
    v-if="chat.attachments.length > 0"
    class="flex flex-wrap gap-1.5 px-2 pb-2"
    data-testid="chat-attachment-strip"
  >
    <div
      v-for="(a, i) in chat.attachments"
      :key="i"
      class="inline-flex items-center gap-1.5 bg-elev border border-border-base rounded-full pl-1 pr-2.5 py-1 text-[11px]"
    >
      <img
        v-if="a.kind === 'image'"
        :src="a.dataUrl"
        class="w-8 h-8 object-cover rounded-full border border-border-base flex-shrink-0"
        :alt="a.filename"
      />
      <span class="font-mono truncate max-w-[160px]" :title="a.filename">{{ a.filename }}</span>
      <span class="opacity-60 text-[10px]">{{ fmtSize(a.sizeBytes) }}</span>
      <button
        type="button"
        class="text-text-dim hover:text-error leading-none w-3 h-3 flex items-center justify-center"
        @click="chat.removeAttachment(i)"
        :aria-label="`Remove ${a.filename}`"
      >×</button>
    </div>
  </div>
</template>
