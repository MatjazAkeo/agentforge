<script setup lang="ts">
import { TEMPLATES, type BundledTemplate } from '@/templates';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; pick: [tpl: BundledTemplate] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center"
    @click.self="emit('close')"
  >
    <div class="bg-panel-strong border border-border-strong rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
      <div class="px-4 py-3 border-b border-border-base flex items-center justify-between">
        <strong>New from Template</strong>
        <button type="button" @click="emit('close')" class="text-text-dim hover:text-text-base text-xl leading-none">×</button>
      </div>
      <ul class="flex-1 overflow-y-auto p-2">
        <li
          v-for="tpl in TEMPLATES"
          :key="tpl.id"
          @click="emit('pick', tpl)"
          class="px-3 py-2 rounded cursor-pointer hover:bg-elev"
        >
          <div class="font-medium text-sm">{{ tpl.name }}</div>
          <div class="text-text-dim text-xs">{{ tpl.description }}</div>
        </li>
      </ul>
      <div class="px-4 py-2 border-t border-border-base text-[11px] opacity-60">
        Picking a template loads it into a new untitled graph. Save As to give it a real location before running.
      </div>
    </div>
  </div>
</template>
