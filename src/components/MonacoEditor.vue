<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as monaco from 'monaco-editor';

const props = defineProps<{
  modelValue: string;
  language?: string;
  height?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const containerRef = ref<HTMLDivElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

onMounted(() => {
  if (!containerRef.value) return;
  editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue,
    language: props.language ?? 'javascript',
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 12,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 8, bottom: 8 },
    renderLineHighlight: 'line',
    folding: true,
    wordWrap: 'on',
  });
  editor.onDidChangeModelContent(() => {
    if (editor) emit('update:modelValue', editor.getValue());
  });
});

watch(() => props.modelValue, (val) => {
  if (editor && val !== editor.getValue()) editor.setValue(val);
});

onBeforeUnmount(() => {
  editor?.dispose();
  editor = null;
});
</script>

<template>
  <div ref="containerRef" :style="{ height: height ?? '240px', width: '100%' }" />
</template>
