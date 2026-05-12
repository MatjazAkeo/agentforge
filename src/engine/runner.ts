import type { Graph } from '@/domain/graph';
import type { Run, NodeResult } from '@/domain/run';
import { topologicalOrderIgnoringBackEdges, incomingEdges } from './scheduler';
import { validateLoopTopology } from './loop-validation';
import { driveLoop, computeLoopBody } from './loop-driver';
import { getNodeDefinition } from '@/nodes/registry';
import { useRunStore } from '@/stores/run';
import { newRunAbortController } from './abort';
import { useGraphStore } from '@/stores/graph';
import { writeRun } from '@/persistence/runs-dir';
import { useRunsStore } from '@/stores/runs';
import { dbRegistry } from '@/sqlite/db-registry';
import { writeFileAtomic } from '@/persistence/atomic-write';
import { assetsDirFor } from '@/persistence/assets-dir';
import type { ToolPackConfig } from '@/domain/node-types';

export interface RunGraphArgs {
  graph: Graph;
  apiKey: string;
  chatSession?: import('@/nodes/registry').ChatSession;
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

  validateLoopTopology(args.graph);
  const order = topologicalOrderIgnoringBackEdges(args.graph);

  // Track body node ids to skip during the main pass — they're fired by driveLoop.
  const skip = new Set<string>();
  for (const node of args.graph.nodes) {
    if (node.type === 'loop-controller') {
      const body = computeLoopBody(args.graph, node.id);
      for (const b of body.bodyNodeIds) skip.add(b);
    }
  }

  const incoming = incomingEdges(args.graph);
  const outputsByNode = new Map<string, Record<string, unknown>>();

  try {
    for (const id of order) {
      if (controller.signal.aborted) {
        run.status = 'aborted';
        break;
      }
      if (skip.has(id)) continue; // fired by driveLoop or after it
      const node = args.graph.nodes.find((n) => n.id === id)!;

      if (node.type === 'loop-controller') {
        try {
          await driveLoop({
            graph: args.graph, run, controllerId: id, outputsByNode,
            apiKey: args.apiKey, signal: controller.signal,
            setLivePreview: (nid, p) => runStore.setLivePreview(nid, p),
            clearLivePreview: (nid) => runStore.clearLivePreview(nid),
            chatSession: args.chatSession,
            graphFilePath: useGraphStore().filePath,
          });
          // max-iterations is a soft halt (graceful give-up), not an error —
          // production ReAct loops use it as a safety cap. The Loop Controller's
          // details.stopReason records 'max-iterations' for transparency. Only
          // unexpected throws (LLM/tool failures, body errors) propagate here.
          //
          // The LC's last-iteration outputs were already published to
          // outputsByNode by driveLoop; post-loop nodes in the main pass read
          // them directly.
        } catch (e) {
          // Mirror the per-node error path: record on the run, mark status, rethrow.
          // driveLoop already set the controller's and failing body node's NodeResult
          // to 'error'; here we lift that to run-level so isRunning flips off and the
          // UI stops the timer / clears the spinner.
          run.errors.push({ nodeId: id, message: (e as Error).message, stack: (e as Error).stack });
          run.status = controller.signal.aborted ? 'aborted' : 'failed';
          throw e;
        }
        continue;
      }

      const def = getNodeDefinition(node.type);
      if (!def) {
        throw new Error(`No definition registered for node type "${node.type}"`);
      }

      // Build inputs from upstream outputs. If multiple edges land on the same target
      // handle, accumulate their source values into a tuple [v1, v2, ...]. Each value
      // is preserved as-is — never spread — so an upstream that emits an array (e.g.
      // Context Group's Context[] sources) keeps its shape. Tool Group's flattenTools
      // handles both flat and nested cases downstream.
      const inputs: Record<string, unknown> = {};
      const accumulated = new Set<string>();
      for (const edge of incoming.get(id) ?? []) {
        const sourceOutputs = outputsByNode.get(edge.source) ?? {};
        const value = sourceOutputs[edge.sourceHandle];
        const handle = edge.targetHandle;
        if (handle in inputs) {
          if (accumulated.has(handle)) {
            (inputs[handle] as unknown[]).push(value);
          } else {
            inputs[handle] = [inputs[handle], value];
            accumulated.add(handle);
          }
        } else {
          inputs[handle] = value;
        }
      }

      // Reactive reference — mutations here propagate to every component watching this node's status.
      const result: NodeResult = run.nodeResults[id];
      result.status = 'running';
      result.startedAt = new Date().toISOString();
      // Snapshot inputs so the inspector can display per-handle values after the run.
      // JSON-clone strips reactive proxies and matches how outputs are persisted.
      result.input = JSON.parse(JSON.stringify(inputs));

      try {
        const ctx = {
          signal: controller.signal,
          details: result.details,
          onStreamUpdate: (preview: string) => runStore.setLivePreview(id, preview),
          onIterationComplete: (record: import('@/domain/run').IterationRecord) => {
            if (!result.iterations) result.iterations = [];
            result.iterations.push(record);
          },
          chatSession: args.chatSession,
          apiKey: args.apiKey,
          graphFilePath: useGraphStore().filePath,
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

  // Persist the run if the graph has been saved to a file. Untitled graphs aren't persisted.
  const graphStore = useGraphStore();
  if (graphStore.filePath) {
    try {
      await writeRun(graphStore.filePath, run);
      await useRunsStore().refresh();
    } catch (e) {
      console.error('Failed to save run:', e);
    }
  }

  // Persist any Tool Pack DBs that were touched during the run. Only on
  // successful completion — failed/aborted runs leave in-memory state intact
  // (and "Reload from disk" reverts) so a partial state doesn't sneak onto
  // disk. The export+atomic-write happens for every Tool Pack with a live
  // DbHost; v1 doesn't track per-write dirty state.
  if (run.status === 'completed' && graphStore.filePath) {
    const graphFilePath = graphStore.filePath;
    for (const node of args.graph.nodes) {
      if (node.type !== 'tool-pack') continue;
      const host = dbRegistry.get(node.id);
      if (!host) continue;
      try {
        const cfg = node.config as ToolPackConfig;
        const filename = (cfg.connection as { db?: string }).db;
        if (!filename) continue;
        const bytes = await host.export();
        const dbPath = `${assetsDirFor(graphFilePath)}/${filename}`;
        await writeFileAtomic(dbPath, new Uint8Array(bytes));
      } catch (e) {
        console.error(`tool-pack: failed to persist ${node.id}:`, e);
        // Don't fail the whole run — in-memory state stays available.
      }
    }
  }

  return run;
}
