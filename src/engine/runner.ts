import type { Graph } from '@/domain/graph';
import type { Run, NodeResult } from '@/domain/run';
import { topologicalOrder, incomingEdges } from './scheduler';
import { getNodeDefinition } from '@/nodes/registry';
import { useRunStore } from '@/stores/run';
import { newRunAbortController } from './abort';

export interface RunGraphArgs {
  graph: Graph;
  apiKey: string;
}

export async function runGraph(args: RunGraphArgs): Promise<Run> {
  const runStore = useRunStore();
  const controller = newRunAbortController();

  const initial: Run = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    graphId: args.graph.id,
    // JSON round-trip beats structuredClone here: it strips Vue reactivity proxies
    // and only commits to JSON-shaped data, matching how the graph is persisted on disk.
    graphSnapshot: JSON.parse(JSON.stringify(args.graph)) as Graph,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'running',
    inputs: {},
    nodeResults: {},
    errors: [],
  };
  for (const node of args.graph.nodes) {
    initial.nodeResults[node.id] = { nodeId: node.id, status: 'idle', details: {} };
  }
  runStore.start(initial);

  // CRITICAL: use the store's reactive Proxy for all mutations from here on.
  // Pinia/Vue wraps the run we passed to start() in a Proxy; mutations on the
  // original `initial` reference bypass that Proxy and don't trigger reactivity.
  const run = runStore.current as Run;

  const order = topologicalOrder(args.graph);
  const incoming = incomingEdges(args.graph);
  const outputsByNode = new Map<string, Record<string, unknown>>();

  try {
    for (const id of order) {
      if (controller.signal.aborted) {
        run.status = 'aborted';
        break;
      }
      const node = args.graph.nodes.find((n) => n.id === id)!;
      const def = getNodeDefinition(node.type);
      if (!def) {
        throw new Error(`No definition registered for node type "${node.type}"`);
      }

      const inputs: Record<string, unknown> = {};
      for (const edge of incoming.get(id) ?? []) {
        const sourceOutputs = outputsByNode.get(edge.source) ?? {};
        inputs[edge.targetHandle] = sourceOutputs[edge.sourceHandle];
      }

      // Reactive reference — mutations here propagate to every component watching this node's status.
      const result: NodeResult = run.nodeResults[id];
      result.status = 'running';
      result.startedAt = new Date().toISOString();

      try {
        const ctx = {
          signal: controller.signal,
          details: result.details,
          onStreamUpdate: (preview: string) => runStore.setLivePreview(id, preview),
          apiKey: args.apiKey,
        };
        const outputs = await def.run(node, inputs, ctx);
        outputsByNode.set(id, outputs);
        result.output = outputs;
        result.status = 'done';
        result.endedAt = new Date().toISOString();
        runStore.clearLivePreview(id);
      } catch (e) {
        result.status = 'error';
        result.endedAt = new Date().toISOString();
        result.errorMessage = (e as Error).message;
        result.errorStack = (e as Error).stack;
        runStore.clearLivePreview(id);
        run.errors.push({ nodeId: id, message: (e as Error).message, stack: (e as Error).stack });
        run.status = controller.signal.aborted ? 'aborted' : 'failed';
        throw e;
      }
    }
    if (run.status === 'running') run.status = 'completed';
  } catch {
    // already recorded
  } finally {
    runStore.finish(run.status);
  }
  return run;
}
