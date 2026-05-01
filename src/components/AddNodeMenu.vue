<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { Node } from '@/domain/graph';
import type { NodeType } from '@/domain/node-types';

interface NodeOption {
  type: NodeType;
  label: string;
  description: string;
}

const ALL_OPTIONS: NodeOption[] = [
  { type: 'input', label: 'Input', description: 'Source value into the graph' },
  { type: 'output', label: 'Output', description: 'Display final value' },
  { type: 'llm-call', label: 'LLM Call', description: 'Send a chat completion to OpenRouter' },
];

const props = defineProps<{
  open: boolean;
  position: { x: number; y: number };
  screenPosition: { x: number; y: number };
}>();
const emit = defineEmits<{ close: [] }>();

const graph = useGraphStore();
const search = ref('');
const focusedIndex = ref(0);

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return ALL_OPTIONS;
  return ALL_OPTIONS.filter((o) =>
    o.label.toLowerCase().includes(q) || o.type.includes(q),
  );
});

watch(() => props.open, (open) => {
  if (open) {
    search.value = '';
    focusedIndex.value = 0;
  }
});

function defaultConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case 'input': return { name: 'input', valueType: 'text', defaultValue: '' };
    case 'output': return { format: 'auto' };
    case 'llm-call': return {
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: null,
      responseFormat: null,
    };
    default: return {};
  }
}

function pick(option: NodeOption) {
  const node: Node = {
    id: crypto.randomUUID(),
    type: option.type,
    position: { ...props.position },
    config: defaultConfig(option.type) as Node['config'],
  };
  graph.addNode(node);
  emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusedIndex.value = Math.min(focusedIndex.value + 1, filtered.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const opt = filtered.value[focusedIndex.value];
    if (opt) pick(opt);
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div v-if="open" class="add-node-menu" :style="{ left: `${screenPosition.x}px`, top: `${screenPosition.y}px` }" @click.stop>
    <div class="header">ADD NODE</div>
    <input v-model="search" placeholder="Search…" class="search" autofocus>
    <ul class="options">
      <li v-for="(opt, i) in filtered" :key="opt.type"
          :class="['option', { focused: i === focusedIndex }]"
          @click="pick(opt)" @mouseenter="focusedIndex = i">
        <strong>{{ opt.label }}</strong>
        <div class="desc">{{ opt.description }}</div>
      </li>
      <li v-if="filtered.length === 0" class="empty">No matches</li>
    </ul>
  </div>
</template>

<style scoped>
.add-node-menu { position: fixed; z-index: 1000; min-width: 220px; max-width: 280px; padding: 6px; background: var(--bg-panel-strong); border: 1px solid var(--border-strong); border-radius: 6px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5); }
.header { padding: 4px 6px; opacity: 0.5; font-size: 10px; }
.search { width: calc(100% - 12px); margin: 4px 6px; padding: 4px 6px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-size: 12px; }
.options { list-style: none; margin: 4px 0 0; padding: 0; max-height: 280px; overflow-y: auto; }
.option { padding: 6px 10px; cursor: pointer; border-radius: 3px; }
.option.focused { background: var(--accent); color: white; }
.option .desc { font-size: 11px; opacity: 0.7; }
.option.focused .desc { opacity: 0.9; }
.empty { padding: 8px 10px; opacity: 0.5; font-size: 12px; }
</style>
