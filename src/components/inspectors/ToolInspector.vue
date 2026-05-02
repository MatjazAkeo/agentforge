<script setup lang="ts">
import { computed } from 'vue';
import { useGraphStore } from '@/stores/graph';
import type { ToolConfig } from '@/domain/node-types';
import MonacoEditor from '@/components/MonacoEditor.vue';

const props = defineProps<{ nodeId: string }>();
const graph = useGraphStore();

const node = computed(() => graph.nodes.find((n) => n.id === props.nodeId));
const cfg = computed(() => (node.value?.config ?? null) as ToolConfig | null);

function update<K extends keyof ToolConfig>(key: K, value: ToolConfig[K]) {
  graph.updateNodeConfig(props.nodeId, { [key]: value });
}

const schemaText = computed({
  get: () => JSON.stringify(cfg.value?.inputSchema ?? {}, null, 2),
  set: (val: string) => {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null) {
        update('inputSchema', parsed as Record<string, unknown>);
      }
    } catch {
      // Ignore parse errors while user is mid-edit
    }
  },
});
</script>

<template>
  <div v-if="cfg" class="flex flex-col gap-2.5">
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Name
      <input
        :value="cfg.name"
        @input="(e) => update('name', (e.target as HTMLInputElement).value)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui font-mono"
        placeholder="snake_case_id"
      >
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Description
      <textarea
        :value="cfg.description"
        @input="(e) => update('description', (e.target as HTMLTextAreaElement).value)"
        rows="2"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui resize-y"
        placeholder="What this tool does — visible to the LLM"
      ></textarea>
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Timeout (ms)
      <input
        type="number"
        :value="cfg.timeoutMs"
        @input="(e) => update('timeoutMs', parseInt((e.target as HTMLInputElement).value, 10) || 30000)"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-sm font-ui"
      >
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Input schema (JSON)
      <textarea
        :value="schemaText"
        @input="(e) => schemaText = (e.target as HTMLTextAreaElement).value"
        rows="6"
        class="bg-elev text-text-base border border-border-base rounded px-2 py-1.5 text-xs font-mono resize-y"
      ></textarea>
    </label>
    <label class="flex flex-col gap-1 text-xs opacity-85">
      Code
      <div class="rounded border border-border-base overflow-hidden">
        <MonacoEditor
          :model-value="cfg.code"
          @update:model-value="(v: string) => update('code', v)"
          language="javascript"
          height="240px"
        />
      </div>
      <div class="text-[11px] opacity-60">
        Function body. Available: <code class="font-mono">inputs</code> (parsed args), <code class="font-mono">helpers.log()</code>, <code class="font-mono">helpers.fetch()</code>. Use <code class="font-mono">return</code> to emit the result.
      </div>
    </label>
  </div>
</template>
