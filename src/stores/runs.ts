import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useGraphStore } from './graph';
import { useRunStore } from './run';
import { listRunFiles, readRun, deleteRun } from '@/persistence/runs-dir';
import type { Run } from '@/domain/run';

export interface RunSummary {
  path: string;
  name: string;
  startedAt: string;
  status: string;
  durationMs?: number;
  tokens?: number;
  inputExcerpt: string;
  outputExcerpt: string;
}

export const useRunsStore = defineStore('runs', () => {
  const list = ref<RunSummary[]>([]);
  const loading = ref(false);
  const loadedRunPath = ref<string | null>(null);
  const graph = useGraphStore();

  async function refresh() {
    if (!graph.filePath) { list.value = []; return; }
    loading.value = true;
    try {
      const files = await listRunFiles(graph.filePath);
      const summaries: RunSummary[] = [];
      for (const f of files) {
        try {
          const r = await readRun(f.path);
          summaries.push(toSummary(r, f));
        } catch {
          // skip malformed run files
        }
      }
      list.value = summaries;
    } finally {
      loading.value = false;
    }
  }

  function toSummary(r: Run, f: { name: string; path: string }): RunSummary {
    let tokens = 0;
    for (const nr of Object.values(r.nodeResults)) {
      const u = nr.details?.usage as { input?: number; output?: number } | undefined;
      if (u) tokens += (u.input ?? 0) + (u.output ?? 0);
    }
    const duration = r.endedAt
      ? new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()
      : undefined;

    // Pull a one-line input excerpt: first user message in any node's request, or first input value
    let inputExcerpt = '';
    for (const nr of Object.values(r.nodeResults)) {
      const req = nr.details?.request as { messages?: Array<{ role: string; content: string }> } | undefined;
      const userMsg = req?.messages?.find((m) => m.role === 'user');
      if (userMsg?.content) {
        inputExcerpt = userMsg.content;
        break;
      }
      const v = nr.details?.value;
      if (typeof v === 'string' && v.length > 0) {
        inputExcerpt = v;
        break;
      }
    }

    // Pull a one-line output excerpt: last assistant text or output node's value
    let outputExcerpt = '';
    for (const nr of Object.values(r.nodeResults)) {
      const resp = nr.details?.response as { text?: string } | undefined;
      if (resp?.text) outputExcerpt = resp.text;
    }
    if (!outputExcerpt) {
      for (const nr of Object.values(r.nodeResults)) {
        const v = nr.details?.value;
        if (typeof v === 'string' && v.length > 0) outputExcerpt = v;
      }
    }

    return {
      path: f.path,
      name: f.name,
      startedAt: r.startedAt,
      status: r.status,
      durationMs: duration,
      tokens,
      inputExcerpt: truncate(inputExcerpt, 60),
      outputExcerpt: truncate(outputExcerpt, 60),
    };
  }

  function truncate(s: string, n: number): string {
    if (!s) return '';
    return s.length > n ? `${s.slice(0, n)}…` : s;
  }

  async function loadRun(path: string) {
    try {
      const r = await readRun(path);
      const runStore = useRunStore();
      // Replace the active run state with this snapshot.
      runStore.start(r);
      // Mark as terminal immediately — historical runs are not in flight.
      runStore.finish(r.status);
      loadedRunPath.value = path;
    } catch (e) {
      console.error('Failed to load run:', e);
    }
  }

  async function deleteRunFile(path: string) {
    try {
      await deleteRun(path);
      if (loadedRunPath.value === path) loadedRunPath.value = null;
      await refresh();
    } catch (e) {
      console.error('Failed to delete run:', e);
    }
  }

  // Auto-refresh when the open graph changes.
  watch(() => graph.filePath, () => { void refresh(); }, { immediate: true });

  return { list, loading, loadedRunPath, refresh, loadRun, deleteRunFile };
});
