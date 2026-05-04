<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useGraphStore } from '@/stores/graph';
import { useSettingsStore } from '@/stores/settings';
import type { Node } from '@/domain/graph';
import type { NodeType } from '@/domain/node-types';

interface NodeOption {
  type: NodeType;
  label: string;
  description: string;
}

const ALL_OPTIONS: NodeOption[] = [
  { type: 'input', label: 'Input', description: 'Source value into the graph' },
  { type: 'file-input', label: 'File Input', description: 'Source content from txt / json / pdf files on disk' },
  { type: 'output', label: 'Output', description: 'Display final value' },
  { type: 'llm-call', label: 'LLM Call', description: 'Send a chat completion to OpenRouter' },
  { type: 'tool', label: 'Tool', description: 'Define a callable function the LLM can use' },
  { type: 'tool-group', label: 'Tool Group', description: 'Aggregate multiple tools into a single edge' },
  { type: 'tool-runner', label: 'Tool Runner', description: 'Execute tool calls emitted by an LLM' },
  { type: 'loop-controller', label: 'Loop Controller', description: 'Cycle anchor for ReAct, retry, refinement loops' },
  { type: 'agent', label: 'Agent', description: 'LLM ↔ Tool loop encapsulated' },
  { type: 'transform', label: 'Transform', description: 'Parse / extract / reformat data between nodes' },
  { type: 'prompt-template', label: 'Prompt Template', description: 'String template with {{var}} placeholders' },
  { type: 'chat-input', label: 'Chat Input', description: 'Source from the chat sidebar' },
  { type: 'chat-output', label: 'Chat Output', description: 'Sink to the chat sidebar' },
];

const props = defineProps<{
  open: boolean;
  position: { x: number; y: number };
  screenPosition: { x: number; y: number };
}>();
const emit = defineEmits<{ close: [] }>();

const graph = useGraphStore();
const settings = useSettingsStore();
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
    case 'input': return { name: 'input', defaultValue: '' };
    case 'file-input': return { files: [] };
    case 'output': return { format: 'auto' };
    case 'llm-call': return {
      model: settings.defaultModel ?? 'openai/gpt-oss-120b:free',
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: null,
      responseFormat: null,
    };
    case 'tool': return {
      name: 'my_tool',
      description: '',
      inputSchema: { type: 'object', properties: {} },
      code: 'return null;',
      timeoutMs: 30000,
    };
    case 'tool-group': return { label: 'tools' };
    case 'tool-runner': return {};
    case 'loop-controller': return {
      maxIterations: 25,
      valueChannels: [{ name: 'value', type: 'json' }],
    };
    case 'agent': return {
      model: settings.defaultModel ?? 'openai/gpt-oss-120b:free',
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: null,
      maxIterations: 25,
      stopCondition: 'no-tool-calls',
    };
    case 'transform': return { mode: 'json-parse' };
    case 'prompt-template': return { template: 'Hello {{name}}!' };
    case 'chat-input': return {};
    case 'chat-output': return { format: 'markdown' };
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
  <div
    v-if="open"
    class="fixed z-[1000] min-w-[220px] max-w-[280px] p-1.5 bg-panel-strong border border-border-strong rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
    :style="{ left: `${screenPosition.x}px`, top: `${screenPosition.y}px` }"
    @click.stop
  >
    <div class="px-1.5 py-1 opacity-50 text-[10px]">ADD NODE</div>
    <input
      v-model="search"
      placeholder="Search…"
      autofocus
      class="block bg-elev text-text-base border border-border-base rounded px-1.5 py-1 text-xs mx-1.5 my-1"
      style="width: calc(100% - 12px)"
    >
    <ul class="list-none mt-2.5 p-0 max-h-[280px] overflow-y-auto">
      <li
        v-for="(opt, i) in filtered"
        :key="opt.type"
        @click="pick(opt)"
        @mouseenter="focusedIndex = i"
        :class="[
          'px-2.5 py-1.5 cursor-pointer rounded',
          i === focusedIndex ? 'bg-accent text-white' : '',
        ]"
      >
        <strong>{{ opt.label }}</strong>
        <div :class="['text-[11px]', i === focusedIndex ? 'opacity-90' : 'opacity-70']">{{ opt.description }}</div>
      </li>
      <li v-if="filtered.length === 0" class="px-2.5 py-2 opacity-50 text-xs">No matches</li>
    </ul>
  </div>
</template>
