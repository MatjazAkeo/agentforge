<script setup lang="ts">
import { computed, ref } from 'vue';
import { marked } from 'marked';
import type { ChatAttachment } from '@/stores/chat';

const props = defineProps<{
  role: 'user' | 'assistant';
  content: string;
  format?: 'text' | 'markdown';
  attachments?: ChatAttachment[];
}>();

const html = computed(() => {
  if (props.format === 'text' || props.role === 'user') {
    const escaped = props.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return escaped;
  }
  return marked.parse(props.content) as string;
});

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const imageAttachments = computed(() =>
  (props.attachments ?? []).filter(
    (a): a is Extract<ChatAttachment, { kind: 'image' }> => a.kind === 'image',
  ),
);
const textAttachments = computed(() =>
  (props.attachments ?? []).filter(
    (a): a is Extract<ChatAttachment, { kind: 'text' }> => a.kind === 'text',
  ),
);

const previewing = ref<Extract<ChatAttachment, { kind: 'image' }> | null>(null);
function openPreview(img: Extract<ChatAttachment, { kind: 'image' }>) { previewing.value = img; }
</script>

<template>
  <div :class="['flex flex-col w-full mb-2', role === 'user' ? 'items-end' : 'items-start']">
    <!-- Inline image thumbnails (user bubble only) -->
    <div
      v-if="role === 'user' && imageAttachments.length > 0"
      class="flex flex-wrap gap-2 max-w-[85%] mb-1 justify-end"
    >
      <img
        v-for="(img, i) in imageAttachments"
        :key="i"
        :src="img.dataUrl"
        class="max-w-[180px] max-h-[180px] object-cover rounded border border-border-base cursor-pointer"
        :alt="img.filename"
        @click="openPreview(img)"
      />
    </div>

    <!-- Text bubble -->
    <div
      v-if="content.length > 0"
      :class="[
        'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
        role === 'user'
          ? 'bg-accent/80 text-white'
          : 'bg-panel border border-border-base text-text-base'
      ]"
      v-html="html"
    />

    <!-- Text-file chips beneath the bubble -->
    <div
      v-if="textAttachments.length > 0"
      :class="[
        'flex flex-wrap gap-1 mt-1 max-w-[85%]',
        role === 'user' ? 'justify-end' : 'justify-start',
      ]"
    >
      <span
        v-for="(a, i) in textAttachments"
        :key="i"
        class="inline-flex items-center gap-1 bg-elev border border-border-base rounded-full px-2 py-0.5 text-[10px] text-text-dim"
        :title="a.filename"
      >
        <span class="font-mono truncate max-w-[140px]">{{ a.filename }}</span>
        <span class="opacity-60">{{ fmtSize(a.sizeBytes) }}</span>
      </span>
    </div>

    <!-- Click-to-expand preview modal -->
    <div
      v-if="previewing"
      class="fixed inset-0 z-[2000] bg-black/70 flex items-center justify-center"
      @click.self="previewing = null"
    >
      <div class="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-2">
        <img
          :src="previewing.dataUrl"
          :alt="previewing.filename"
          class="max-w-full max-h-[80vh] object-contain"
        />
        <button
          type="button"
          class="text-text-base bg-elev border border-border-base rounded px-3 py-1 text-xs"
          @click="previewing = null"
        >Close</button>
      </div>
    </div>
  </div>
</template>
