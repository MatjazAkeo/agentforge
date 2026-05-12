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

interface NodeCategory {
  name: string;
  options: NodeOption[];
}

const CATEGORIES: NodeCategory[] = [
  {
    name: 'Input',
    options: [
      { type: 'input', label: 'Input', description: 'Source value into the graph' },
      { type: 'file-input', label: 'File Input', description: 'Source content from txt / json / pdf files on disk' },
      { type: 'context-group', label: 'Context Group', description: 'Merge multiple context wires (system + body + last-user fold)' },
      { type: 'chat-input', label: 'Chat Input', description: 'Source from the chat sidebar' },
    ],
  },
  {
    name: 'Output',
    options: [
      { type: 'output', label: 'Output', description: 'Display final value' },
      { type: 'chat-output', label: 'Chat Output', description: 'Sink to the chat sidebar' },
    ],
  },
  {
    name: 'LLM',
    options: [
      { type: 'llm-call', label: 'LLM Call', description: 'Send a chat completion to OpenRouter' },
      { type: 'agent', label: 'Agent', description: 'LLM ↔ Tool loop encapsulated' },
      { type: 'loop-controller', label: 'Loop Controller', description: 'Cycle anchor for ReAct, retry, refinement loops' },
    ],
  },
  {
    name: 'Tools',
    options: [
      { type: 'tool', label: 'Tool', description: 'Define a callable function the LLM can use' },
      { type: 'tool-group', label: 'Tool Group', description: 'Aggregate multiple tools into a single edge' },
      { type: 'tool-pack', label: 'Tool Pack', description: 'Group multiple tools in one node — plain or SQLite-backed' },
      { type: 'tool-runner', label: 'Tool Runner', description: 'Execute tool calls emitted by an LLM' },
    ],
  },
  {
    name: 'Parse',
    options: [
      { type: 'transform', label: 'Transform', description: 'Parse / extract / reformat data between nodes' },
      { type: 'prompt-template', label: 'Prompt Template', description: 'String template with {{var}} placeholders' },
    ],
  },
];

const ALL_OPTIONS: NodeOption[] = CATEGORIES.flatMap((c) => c.options);

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
const selectedCategory = ref<string | null>(null);

type Mode = 'categories' | 'search-results' | 'category-detail';

const mode = computed<Mode>(() => {
  if (selectedCategory.value !== null) return 'category-detail';
  return search.value.trim() ? 'search-results' : 'categories';
});

const searchResults = computed<NodeOption[]>(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return [];
  return ALL_OPTIONS.filter(
    (o) => o.label.toLowerCase().includes(q) || o.type.includes(q),
  );
});

const detailOptions = computed<NodeOption[]>(() => {
  if (selectedCategory.value === null) return [];
  return CATEGORIES.find((c) => c.name === selectedCategory.value)?.options ?? [];
});

watch(() => props.open, (open) => {
  if (open) {
    search.value = '';
    selectedCategory.value = null;
    focusedIndex.value = 0;
  }
});

watch(mode, () => {
  focusedIndex.value = 0;
});

function defaultConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case 'input': return { name: 'input', defaultValue: '' };
    case 'file-input': return { files: [] };
    case 'output': return { format: 'auto' };
    case 'llm-call': return {
      model: settings.defaultModel ?? 'openrouter/free',
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
    case 'context-group': return { label: 'context' };
    case 'tool-runner': return {};
    case 'tool-pack': return {
      flavor: 'none',
      connection: {},
      tools: [],
    };
    case 'loop-controller': return {
      maxIterations: 25,
      valueChannels: [{ name: 'value', type: 'json' }],
    };
    case 'agent': return {
      model: settings.defaultModel ?? 'openrouter/free',
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

function openCategory(name: string) {
  selectedCategory.value = name;
}

function backToCategories() {
  selectedCategory.value = null;
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (mode.value === 'category-detail') backToCategories();
    else emit('close');
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const len = mode.value === 'categories' ? CATEGORIES.length
      : mode.value === 'search-results' ? searchResults.value.length
      : detailOptions.value.length;
    focusedIndex.value = Math.min(focusedIndex.value + 1, Math.max(0, len - 1));
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (mode.value === 'categories') {
      const cat = CATEGORIES[focusedIndex.value];
      if (cat) openCategory(cat.name);
    } else if (mode.value === 'search-results') {
      const opt = searchResults.value[focusedIndex.value];
      if (opt) pick(opt);
    } else {
      const opt = detailOptions.value[focusedIndex.value];
      if (opt) pick(opt);
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div
    v-if="open"
    class="fixed z-[1000] min-w-[240px] max-w-[300px] p-1.5 bg-panel-strong border border-border-strong rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
    :style="{ left: `${screenPosition.x}px`, top: `${screenPosition.y}px` }"
    @click.stop
  >
    <button
      v-if="mode === 'category-detail'"
      type="button"
      @click="backToCategories"
      class="flex items-center gap-1 w-full px-1.5 py-1 rounded text-left text-text-dim hover:text-text-base hover:bg-elev cursor-pointer"
      title="Back to categories (Esc)"
      aria-label="Back to categories"
    >
      <span class="leading-none text-base">‹</span>
      <span class="opacity-50 text-[10px] uppercase tracking-wider">{{ selectedCategory }}</span>
    </button>
    <div v-else class="px-1.5 py-1 opacity-50 text-[10px]">ADD NODE</div>

    <input
      v-if="mode !== 'category-detail'"
      v-model="search"
      placeholder="Search…"
      autofocus
      class="block bg-elev text-text-base border border-border-base rounded px-1.5 py-1 text-xs mx-1.5 my-1"
      style="width: calc(100% - 12px)"
    >

    <!-- Step 1: categories -->
    <ul v-if="mode === 'categories'" class="list-none mt-1.5 p-0 max-h-[360px] overflow-y-auto">
      <li
        v-for="(cat, i) in CATEGORIES"
        :key="cat.name"
        @click="openCategory(cat.name)"
        @mouseenter="focusedIndex = i"
        :class="[
          'px-2.5 py-1.5 cursor-pointer rounded flex items-center justify-between gap-2',
          i === focusedIndex ? 'bg-accent text-white' : '',
        ]"
      >
        <span class="flex flex-col">
          <strong>{{ cat.name }}</strong>
          <span :class="['text-[11px]', i === focusedIndex ? 'opacity-90' : 'opacity-70']">
            {{ cat.options.length }} node{{ cat.options.length === 1 ? '' : 's' }}
          </span>
        </span>
        <span :class="['text-base leading-none', i === focusedIndex ? 'opacity-90' : 'opacity-50']">›</span>
      </li>
    </ul>

    <!-- Step 1 (search active): flat results across all categories -->
    <ul v-else-if="mode === 'search-results'" class="list-none mt-1.5 p-0 max-h-[360px] overflow-y-auto">
      <li
        v-for="(opt, i) in searchResults"
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
      <li v-if="searchResults.length === 0" class="px-2.5 py-2 opacity-50 text-xs">No matches</li>
    </ul>

    <!-- Step 2: nodes in the selected category -->
    <ul v-else class="list-none mt-1.5 p-0 max-h-[360px] overflow-y-auto">
      <li
        v-for="(opt, i) in detailOptions"
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
    </ul>
  </div>
</template>
