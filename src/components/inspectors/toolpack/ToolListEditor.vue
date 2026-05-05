<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { ToolPackConfig, ToolPackTool } from '@/domain/node-types';
import MonacoEditor from '@/components/MonacoEditor.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ToolPackConfig | null);
const tools = computed(() => cfg.value?.tools ?? []);

const selectedIdx = ref<number | null>(tools.value.length > 0 ? 0 : null);

const selected = computed<ToolPackTool | null>(() =>
  selectedIdx.value !== null && selectedIdx.value < tools.value.length ? tools.value[selectedIdx.value] : null,
);

const inputSchemaText = ref('');
const inputSchemaError = ref<string | null>(null);

function refreshSchemaText() {
  if (selected.value) {
    inputSchemaText.value = JSON.stringify(selected.value.inputSchema ?? {}, null, 2);
    inputSchemaError.value = null;
  } else {
    inputSchemaText.value = '';
  }
}
refreshSchemaText();

function setTools(next: ToolPackTool[]) {
  graph.updateNodeConfig(props.nodeId, { tools: next });
}

function onAdd() {
  const next = [...tools.value, {
    name: `tool_${tools.value.length + 1}`,
    description: '',
    inputSchema: { type: 'object', properties: {} },
    code: 'return (await sqlite.query(\'SELECT 1 as ok\')).rows;',
  }];
  setTools(next);
  selectedIdx.value = next.length - 1;
  refreshSchemaText();
}

function onSelect(i: number) {
  selectedIdx.value = i;
  refreshSchemaText();
}

function onRemove(i: number) {
  if (!confirm(`Remove tool "${tools.value[i].name}"?`)) return;
  const next = tools.value.filter((_, j) => j !== i);
  setTools(next);
  if (selectedIdx.value !== null && selectedIdx.value >= next.length) {
    selectedIdx.value = next.length > 0 ? next.length - 1 : null;
  }
  refreshSchemaText();
}

function update<K extends keyof ToolPackTool>(key: K, value: ToolPackTool[K]) {
  if (selectedIdx.value === null) return;
  const next = tools.value.map((t, i) => i === selectedIdx.value ? { ...t, [key]: value } : t);
  setTools(next);
}

function onInputSchemaChange(text: string) {
  inputSchemaText.value = text;
  try {
    const parsed = JSON.parse(text);
    inputSchemaError.value = null;
    update('inputSchema', parsed);
  } catch (e) {
    inputSchemaError.value = (e as Error).message;
    // Don't update — keep the last valid schema in config.
  }
}

const nameClash = computed(() => {
  if (!selected.value || selectedIdx.value === null) return false;
  return tools.value.some((t, i) => i !== selectedIdx.value && t.name === selected.value!.name);
});
const nameInvalid = computed(() => {
  if (!selected.value) return false;
  return !/^[a-zA-Z0-9_-]+$/.test(selected.value.name);
});
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2">
    <div class="text-xs opacity-60">Tools</div>

    <ul v-if="tools.length > 0" class="flex flex-col gap-0.5">
      <li v-for="(t, i) in tools" :key="i"
        :class="['flex items-center gap-2 px-2 py-1 rounded border cursor-pointer text-[11px]',
          selectedIdx === i ? 'bg-accent/15 border-accent' : 'bg-elev border-border-base hover:bg-panel']"
        @click="onSelect(i)"
      >
        <div class="flex flex-col flex-1 min-w-0">
          <span class="font-mono truncate">{{ t.name || '(unnamed)' }}</span>
          <span v-if="t.description" class="opacity-60 text-[10px] truncate">{{ t.description }}</span>
        </div>
        <button type="button" class="text-text-dim hover:text-error leading-none px-1" @click.stop="onRemove(i)">×</button>
      </li>
    </ul>
    <div v-else class="text-text-dim italic text-[11px]">— no tools yet —</div>

    <button type="button" class="bg-accent/15 text-accent border border-accent rounded px-2.5 py-1 text-[11px] cursor-pointer hover:bg-accent/25 self-start" @click="onAdd">Add tool</button>

    <div v-if="selected" class="flex flex-col gap-2 pt-2 border-t border-border-base">
      <label class="flex flex-col gap-0.5 text-[11px] opacity-85">
        Name
        <input :value="selected.name" @input="(e) => update('name', (e.target as HTMLInputElement).value)" class="bg-elev border border-border-base rounded px-2 py-1 font-mono text-xs" />
        <span v-if="nameClash" class="text-error text-[10px]">duplicate name</span>
        <span v-else-if="nameInvalid" class="text-error text-[10px]">use [a-zA-Z0-9_-] only</span>
      </label>
      <label class="flex flex-col gap-0.5 text-[11px] opacity-85">
        Description
        <textarea :value="selected.description" @input="(e) => update('description', (e.target as HTMLTextAreaElement).value)" rows="2" class="bg-elev border border-border-base rounded px-2 py-1 text-xs resize-y" />
      </label>
      <div class="flex flex-col gap-0.5 text-[11px] opacity-85">
        Input schema (JSON)
        <MonacoEditor :model-value="inputSchemaText" language="json" height="120px" @update:model-value="onInputSchemaChange" />
        <span v-if="inputSchemaError" class="text-error text-[10px]">JSON parse error: {{ inputSchemaError }}</span>
      </div>
      <div class="flex flex-col gap-0.5 text-[11px] opacity-85">
        Code
        <MonacoEditor :model-value="selected.code" language="javascript" height="240px" @update:model-value="(v: string) => update('code', v)" />
      </div>
    </div>
    <div v-else class="text-text-dim italic text-[11px]">Select a tool from the list, or click Add tool.</div>
  </div>
</template>
