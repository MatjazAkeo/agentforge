// src/stores/run.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Run, NodeResult, RunStatus } from '@/domain/run';

export const useRunStore = defineStore('run', () => {
  const current = ref<Run | null>(null);
  const totalApiCalls = ref(0);
  const totalTokensIn = ref(0);
  const totalTokensOut = ref(0);
  const startedAtMs = ref<number | null>(null);
  const elapsedMs = ref(0);
  const livePreviews = ref<Record<string, string>>({});

  const isRunning = computed(() => current.value?.status === 'running');

  function setLivePreview(nodeId: string, preview: string) {
    livePreviews.value[nodeId] = preview;
  }
  function clearLivePreview(nodeId: string) {
    delete livePreviews.value[nodeId];
  }
  function clearLivePreviews() {
    livePreviews.value = {};
  }

  function start(run: Run) {
    current.value = run;
    totalApiCalls.value = 0;
    totalTokensIn.value = 0;
    totalTokensOut.value = 0;
    startedAtMs.value = performance.now();
    elapsedMs.value = 0;
    clearLivePreviews();
  }

  function tick() {
    if (startedAtMs.value !== null && isRunning.value) {
      elapsedMs.value = performance.now() - startedAtMs.value;
    }
  }

  function recordResult(result: NodeResult) {
    if (!current.value) return;
    current.value.nodeResults[result.nodeId] = result;
  }

  function addTokens(input: number, output: number) {
    totalTokensIn.value += input;
    totalTokensOut.value += output;
  }

  function incrementApiCalls() {
    totalApiCalls.value += 1;
  }

  function finish(status: RunStatus) {
    if (!current.value) return;
    // Safety net: a caller that lost track of an error path may pass 'running'
    // here; coerce to 'failed' so the UI never gets stuck thinking we're still
    // running. Any explicit 'completed' / 'failed' / 'aborted' is honored.
    current.value.status = status === 'running' ? 'failed' : status;
    current.value.endedAt = new Date().toISOString();
    if (startedAtMs.value !== null) {
      elapsedMs.value = performance.now() - startedAtMs.value;
    }
  }

  return {
    current, totalApiCalls, totalTokensIn, totalTokensOut, elapsedMs, isRunning, livePreviews,
    start, tick, recordResult, addTokens, incrementApiCalls, finish,
    setLivePreview, clearLivePreview, clearLivePreviews,
  };
});
