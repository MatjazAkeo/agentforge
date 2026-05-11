// src/stores/graph.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Graph, Node, Edge } from '@/domain/graph';
import type { FileInputConfig } from '@/domain/node-types';
import { dbRegistry } from '@/sqlite/db-registry';

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
      if (n.type === 'tool') {
        const code = (n.config as { code?: string }).code;
        return typeof code === 'string' && code.trim().length > 0;
      }
      // Transform's `custom` mode evaluates user JS at runtime — same trust model.
      if (n.type === 'transform') {
        const cfg = n.config as { mode?: string; code?: string };
        return cfg.mode === 'custom' && typeof cfg.code === 'string' && cfg.code.trim().length > 0;
      }
      // Tool Pack tools each have their own JS body — extra load-bearing now
      // that v1 supports DML/DDL.
      if (n.type === 'tool-pack') {
        const cfg = n.config as { tools?: Array<{ code?: string }> };
        return (cfg.tools ?? []).some((t) => typeof t.code === 'string' && t.code.trim().length > 0);
      }
      return false;
    });
  }

  function reset() {
    // Tear down any Tool Pack DB workers from the previous graph; the new
    // empty graph has no Tool Pack nodes referencing them.
    dbRegistry.disposeAll();
    graph.value = newEmptyGraph();
    filePath.value = null;
    dirty.value = false;
  }

  function load(g: Graph, path: string | null) {
    // Tear down DB workers from the previous graph before swapping in the new
    // node set — node ids may collide and we don't want a Tool Pack node
    // pointing at a stale worker.
    dbRegistry.disposeAll();
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
    // If this was a Tool Pack, its persistent DB worker should be torn down.
    // dispose() is a no-op for ids not in the registry, so unconditional call
    // is fine.
    dbRegistry.dispose(id);
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
    if (!n) return;
    n.config = { ...n.config, ...config };
    dirty.value = true;
    recomputeContainsCustomCode();

    if (n.type === 'file-input') {
      const cfg = n.config as FileInputConfig;
      const files = cfg.files ?? [];
      const hasImages = files.some((f) => f.kind === 'image');
      // Mirrors FileInputNode.vue's `hasText` rule: empty config still emits
      // an empty text wire (legacy compat), otherwise text port exists only
      // when at least one text-kind file is attached.
      const hasText = files.length === 0 || files.some((f) => (f.kind ?? 'text') === 'text');
      if (!hasImages) {
        graph.value.edges = graph.value.edges.filter(
          (e) => !(e.source === id && e.sourceHandle === 'images'),
        );
      }
      if (!hasText) {
        graph.value.edges = graph.value.edges.filter(
          (e) => !(e.source === id && e.sourceHandle === 'text'),
        );
      }
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
