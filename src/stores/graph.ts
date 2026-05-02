// src/stores/graph.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Graph, Node, Edge } from '@/domain/graph';

function newEmptyGraph(): Graph {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: 'Untitled',
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    containsCustomCode: false,
  };
}

export const useGraphStore = defineStore('graph', () => {
  const graph = ref<Graph>(newEmptyGraph());
  const filePath = ref<string | null>(null);
  const dirty = ref(false);

  const nodes = computed(() => graph.value.nodes);
  const edges = computed(() => graph.value.edges);

  function recomputeContainsCustomCode() {
    graph.value.containsCustomCode = graph.value.nodes.some((n) => {
      if (n.type !== 'tool') return false;
      const code = (n.config as { code?: string }).code;
      return typeof code === 'string' && code.trim().length > 0;
    });
  }

  function reset() {
    graph.value = newEmptyGraph();
    filePath.value = null;
    dirty.value = false;
  }

  function load(g: Graph, path: string) {
    graph.value = g;
    filePath.value = path;
    dirty.value = false;
    recomputeContainsCustomCode();
  }

  function markSaved(path: string) {
    filePath.value = path;
    dirty.value = false;
  }

  function addNode(node: Node) {
    graph.value.nodes.push(node);
    dirty.value = true;
    recomputeContainsCustomCode();
  }

  function removeNode(id: string) {
    graph.value.nodes = graph.value.nodes.filter((n) => n.id !== id);
    graph.value.edges = graph.value.edges.filter((e) => e.source !== id && e.target !== id);
    dirty.value = true;
    recomputeContainsCustomCode();
  }

  function addEdge(edge: Edge) {
    graph.value.edges.push(edge);
    dirty.value = true;
  }

  function removeEdge(id: string) {
    graph.value.edges = graph.value.edges.filter((e) => e.id !== id);
    dirty.value = true;
  }

  function updateNodeConfig(id: string, config: Record<string, unknown>) {
    const n = graph.value.nodes.find((x) => x.id === id);
    if (n) {
      n.config = { ...n.config, ...config };
      dirty.value = true;
      recomputeContainsCustomCode();
    }
  }

  function updateNodePosition(id: string, x: number, y: number) {
    const n = graph.value.nodes.find((x) => x.id === id);
    if (n) {
      n.position = { x, y };
      dirty.value = true;
    }
  }

  return {
    graph, filePath, dirty, nodes, edges,
    reset, load, markSaved,
    addNode, removeNode, addEdge, removeEdge,
    updateNodeConfig, updateNodePosition,
  };
});
