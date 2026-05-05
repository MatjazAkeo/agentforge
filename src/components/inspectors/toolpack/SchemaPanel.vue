<script setup lang="ts">
import { ref, watch } from 'vue';
import { dbRegistry } from '@/sqlite/db-registry';
import type { ColumnInfo } from '@/sqlite/types';

const props = defineProps<{ nodeId: string; refreshKey?: number }>();

const tables = ref<string[]>([]);
const expanded = ref<Set<string>>(new Set());
const columns = ref<Record<string, ColumnInfo[]>>({});
const error = ref<string | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const host = dbRegistry.get(props.nodeId);
    if (!host || !host.isInitialized()) {
      // Either no host yet, or one created but never init'd (e.g. a failed
      // run hit dbRegistry.getOrCreate before init). No schema to show
      // until ConnectionPanel attaches a DB.
      tables.value = [];
      return;
    }
    tables.value = await host.tables();
  } catch (e) {
    error.value = (e as Error).message;
    tables.value = [];
  } finally {
    loading.value = false;
  }
}

async function toggleTable(t: string) {
  if (expanded.value.has(t)) {
    expanded.value.delete(t);
    expanded.value = new Set(expanded.value);
    return;
  }
  expanded.value.add(t);
  expanded.value = new Set(expanded.value);
  if (!columns.value[t]) {
    const host = dbRegistry.get(props.nodeId);
    if (!host) return;
    columns.value[t] = await host.columns(t);
  }
}

watch(() => props.refreshKey, () => {
  columns.value = {};
  expanded.value = new Set();
  void load();
}, { immediate: true });

watch(() => props.nodeId, () => {
  columns.value = {};
  expanded.value = new Set();
  void load();
});
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="text-xs opacity-60">Schema</div>
    <div v-if="loading" class="text-[11px] opacity-50 italic">loading…</div>
    <div v-else-if="error" class="text-error text-[11px]">{{ error }}</div>
    <div v-else-if="tables.length === 0" class="text-text-dim italic text-[11px]">— no tables —</div>
    <ul v-else class="flex flex-col gap-0.5">
      <li v-for="t in tables" :key="t" class="text-[11px]">
        <button type="button" class="font-mono opacity-90 hover:opacity-100 cursor-pointer" @click="toggleTable(t)">
          {{ expanded.has(t) ? '▾' : '▸' }} {{ t }}
        </button>
        <ul v-if="expanded.has(t)" class="ml-3 mt-0.5">
          <li v-for="c in (columns[t] ?? [])" :key="c.name" class="font-mono text-[10px] opacity-75">
            {{ c.name }} <span class="opacity-60">{{ c.type }}{{ c.pk ? ' · pk' : '' }}{{ c.notnull ? ' · not null' : '' }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>
