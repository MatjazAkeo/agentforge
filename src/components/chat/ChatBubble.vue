<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{ role: 'user' | 'assistant'; content: string; format?: 'text' | 'markdown' }>();

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
</script>

<template>
  <div :class="['flex w-full mb-2', role === 'user' ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
        role === 'user'
          ? 'bg-accent/80 text-white'
          : 'bg-panel border border-border-base text-text-base'
      ]"
      v-html="html"
    />
  </div>
</template>
