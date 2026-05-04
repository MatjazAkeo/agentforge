<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
  role: 'user' | 'assistant';
  content: string;
  format?: 'text' | 'markdown';
  attachments?: Array<{ filename: string; sizeBytes: number }>;
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
</script>

<template>
  <div :class="['flex flex-col w-full mb-2', role === 'user' ? 'items-end' : 'items-start']">
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
    <div
      v-if="attachments && attachments.length > 0"
      :class="[
        'flex flex-wrap gap-1 mt-1 max-w-[85%]',
        role === 'user' ? 'justify-end' : 'justify-start',
      ]"
    >
      <span
        v-for="(a, i) in attachments"
        :key="i"
        class="inline-flex items-center gap-1 bg-elev border border-border-base rounded-full px-2 py-0.5 text-[10px] text-text-dim"
        :title="a.filename"
      >
        <span class="font-mono truncate max-w-[140px]">{{ a.filename }}</span>
        <span class="opacity-60">{{ fmtSize(a.sizeBytes) }}</span>
      </span>
    </div>
  </div>
</template>
