import type { Graph } from '@/domain/graph';
import type { Run, NodeResult } from '@/domain/run';
import { findBackEdges } from './loop-validation';
import { topologicalOrder } from './scheduler';
import { getNodeDefinition } from '@/nodes/registry';
import type { LoopControllerConfig } from '@/domain/node-types';

export interface LoopBody {
  /** Node ids that re-run on every iteration. */
  bodyNodeIds: string[];
  /** Break nodes attached to this controller — fire once after termination. */
  breakNodeIds: string[];
  /** Edges internal to the body (excluding the back-edges). */
  internalEdges: Graph['edges'];
  /** The back-edges from body → loop-controller. */
  backEdges: Graph['edges'];
}

/**
 * Resolves which body nodes belong to the given Loop Controller.
 * Body = nodes downstream of the LC's outputs that lie on a path back to the LC
 * via a back-edge. Break nodes are listed separately because they fire only once.
 */
export function computeLoopBody(graph: Graph, controllerId: string): LoopBody {
  const back = findBackEdges(graph).filter((e) => e.target === controllerId);
  const fwd = new Map<string, Graph['edges']>();
  for (const node of graph.nodes) fwd.set(node.id, []);
  for (const edge of graph.edges) fwd.get(edge.source)?.push(edge);

  // Forward reachable from LC, *not including* edges back into LC itself.
  const reachable = new Set<string>();
  const stack: string[] = [controllerId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const edge of fwd.get(id) ?? []) {
      if (edge.target === controllerId) continue;
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        stack.push(edge.target);
      }
    }
  }

  // Body = reachable nodes that can reach back to LC via a back-edge.
  const sourcesOfBack = new Set(back.map((e) => e.source));
  const reverse = new Map<string, string[]>();
  for (const node of graph.nodes) reverse.set(node.id, []);
  for (const edge of graph.edges) reverse.get(edge.target)?.push(edge.source);

  const reachesBack = new Set<string>();
  const seedStack = [...sourcesOfBack];
  for (const s of seedStack) reachesBack.add(s);
  while (seedStack.length) {
    const id = seedStack.pop()!;
    for (const upstream of reverse.get(id) ?? []) {
      if (!reachesBack.has(upstream)) {
        reachesBack.add(upstream);
        seedStack.push(upstream);
      }
    }
  }

  const bodyNodeIds: string[] = [];
  const breakNodeIds: string[] = [];
  for (const id of reachable) {
    const node = graph.nodes.find((x) => x.id === id);
    if (!node) continue;
    if (node.type === 'break') {
      breakNodeIds.push(id);
      continue;
    }
    if (reachesBack.has(id)) bodyNodeIds.push(id);
  }

  const bodySet = new Set(bodyNodeIds);
  const internalEdges = graph.edges.filter(
    (e) =>
      (bodySet.has(e.source) || e.source === controllerId) &&
      (bodySet.has(e.target) || e.target === controllerId) &&
      !back.some((b) => b.id === e.id),
  );

  return { bodyNodeIds, breakNodeIds, internalEdges, backEdges: back };
}

/**
 * Runs the loop body for one Loop Controller until termination.
 * Mutates the run's NodeResults in place — body nodes get an IterationRecord
 * appended each iteration, the controller's `details.iterationCount` is updated,
 * and break nodes' outputs are written when the loop exits.
 */
export interface LoopDriverResult {
  breakOutputs: Record<string, Record<string, unknown>>;
  bodyOutputs: Record<string, Record<string, unknown>>;
  controllerOutputs: Record<string, unknown>;
  iterationCount: number;
  stopReason: 'continue-false' | 'max-iterations' | 'aborted' | 'error';
}

export interface LoopDriverArgs {
  graph: Graph;
  run: Run;
  controllerId: string;
  /** Outputs of all upstream nodes already executed in the surrounding pass. */
  outputsByNode: Map<string, Record<string, unknown>>;
  apiKey: string;
  signal: AbortSignal;
  setLivePreview?: (nodeId: string, preview: string) => void;
  clearLivePreview?: (nodeId: string) => void;
}

export async function driveLoop(args: LoopDriverArgs): Promise<LoopDriverResult> {
  const { graph, run, controllerId, outputsByNode, apiKey, signal } = args;
  const controllerNode = graph.nodes.find((n) => n.id === controllerId)!;
  const cfg = controllerNode.config as LoopControllerConfig;
  const body = computeLoopBody(graph, controllerId);

  // Build inputs for the controller from the upstream graph (default-* and any non-back edges).
  const allEdgesIntoController = graph.edges.filter(
    (e) => e.target === controllerId && !body.backEdges.some((b) => b.id === e.id),
  );
  const initialInputs: Record<string, unknown> = {};
  for (const edge of allEdgesIntoController) {
    const upstream = outputsByNode.get(edge.source) ?? {};
    initialInputs[edge.targetHandle] = upstream[edge.sourceHandle];
  }

  let iteration = 1;
  let stopReason: LoopDriverResult['stopReason'] = 'continue-false';
  let bodyOutputsByNode = new Map<string, Record<string, unknown>>();
  let controllerOutputs: Record<string, unknown> = {};
  let cycledChannelValues: Record<string, unknown> = {};
  let lastContinue: unknown = false;

  // Topological order *within* the body (using internalEdges only).
  const bodyOrder = topologicalOrder({
    ...graph,
    nodes: graph.nodes.filter((n) => body.bodyNodeIds.includes(n.id) || n.id === controllerId),
    edges: body.internalEdges,
  });

  // Pre-init iterations arrays on body nodes and the controller.
  for (const id of [...body.bodyNodeIds, controllerId]) {
    if (!run.nodeResults[id].iterations) run.nodeResults[id].iterations = [];
  }

  while (true) {
    if (signal.aborted) { stopReason = 'aborted'; break; }
    if (iteration > cfg.maxIterations) { stopReason = 'max-iterations'; break; }

    // 1) Run the controller for this iteration.
    const ctrlResult: NodeResult = run.nodeResults[controllerId];
    ctrlResult.status = 'running';
    const ctrlInputs: Record<string, unknown> = { ...initialInputs, iteration };
    for (const [k, v] of Object.entries(cycledChannelValues)) ctrlInputs[k] = v;
    const ctrlDef = getNodeDefinition('loop-controller')!;
    const ctrlIterDetails: Record<string, unknown> = {};
    let ctrlOut: Record<string, unknown>;
    try {
      ctrlOut = await ctrlDef.run(controllerNode, ctrlInputs, {
        signal, details: ctrlIterDetails, apiKey,
      });
    } catch (e) {
      ctrlResult.status = 'error';
      ctrlResult.errorMessage = (e as Error).message;
      stopReason = 'error';
      throw e;
    }
    ctrlResult.iterations!.push({
      iteration, startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      inputs: JSON.parse(JSON.stringify(ctrlInputs)),
      output: JSON.parse(JSON.stringify(ctrlOut)),
      details: ctrlIterDetails,
    });
    controllerOutputs = ctrlOut;
    outputsByNode.set(controllerId, ctrlOut);

    // 2) Run each body node in topological order.
    bodyOutputsByNode = new Map();
    for (const id of bodyOrder) {
      if (id === controllerId) continue;
      if (!body.bodyNodeIds.includes(id)) continue;
      if (signal.aborted) { stopReason = 'aborted'; break; }

      const node = graph.nodes.find((n) => n.id === id)!;
      const def = getNodeDefinition(node.type)!;
      const incoming = body.internalEdges.filter((e) => e.target === id);
      const inputs: Record<string, unknown> = {};
      for (const edge of incoming) {
        const src = edge.source === controllerId
          ? controllerOutputs
          : (bodyOutputsByNode.get(edge.source) ?? outputsByNode.get(edge.source) ?? {});
        // Fan-in (multiple edges to same handle) — promote to array on the second hit.
        if (edge.targetHandle in inputs) {
          const existing = inputs[edge.targetHandle];
          inputs[edge.targetHandle] = Array.isArray(existing)
            ? [...existing, src[edge.sourceHandle]]
            : [existing, src[edge.sourceHandle]];
        } else {
          inputs[edge.targetHandle] = src[edge.sourceHandle];
        }
      }

      const result: NodeResult = run.nodeResults[id];
      result.status = 'running';
      const iterStart = new Date().toISOString();
      const iterDetails: Record<string, unknown> = {};
      try {
        const out = await def.run(node, inputs, {
          signal, details: iterDetails, apiKey,
          onStreamUpdate: (preview) => args.setLivePreview?.(id, preview),
        });
        bodyOutputsByNode.set(id, out);
        result.output = out;
        result.input = inputs;
        result.status = 'done';
        args.clearLivePreview?.(id);
        result.iterations!.push({
          iteration, startedAt: iterStart, endedAt: new Date().toISOString(),
          inputs: JSON.parse(JSON.stringify(inputs)),
          output: JSON.parse(JSON.stringify(out)),
          details: iterDetails,
        });
      } catch (e) {
        result.status = 'error';
        result.errorMessage = (e as Error).message;
        result.errorStack = (e as Error).stack;
        args.clearLivePreview?.(id);
        stopReason = 'error';
        throw e;
      }
    }

    // 3) Read back-edges to determine `continue` and the next iteration's channel values.
    cycledChannelValues = {};
    let sawContinue = false;
    for (const back of body.backEdges) {
      const src = bodyOutputsByNode.get(back.source) ?? outputsByNode.get(back.source) ?? {};
      const value = src[back.sourceHandle];
      if (back.targetHandle === 'continue') {
        lastContinue = value;
        sawContinue = true;
      } else if (back.targetHandle.startsWith('input-')) {
        cycledChannelValues[back.targetHandle] = value;
      }
    }

    // 4) Halt check. Empty arrays count as falsy (alongside null/undefined/false/0/'') so that
    //    wiring `LLMCall.toolCalls → LoopController.continue` is the natural ReAct halt.
    const isTruthy = (v: unknown) =>
      v !== null && v !== undefined && v !== false && v !== 0 && v !== '' &&
      !(Array.isArray(v) && v.length === 0);
    if (!sawContinue || !isTruthy(lastContinue)) { stopReason = 'continue-false'; break; }
    iteration++;
  }

  // Mark controller done and stash stop reason.
  const ctrl: NodeResult = run.nodeResults[controllerId];
  // Note: stopReason cannot be 'error' here — error paths always throw before this point.
  ctrl.status = 'done';
  ctrl.details.stopReason = stopReason;
  ctrl.details.iterationCount = iteration;

  // 5) Fire break nodes once with the latest body outputs.
  const breakOutputs: Record<string, Record<string, unknown>> = {};
  for (const breakId of body.breakNodeIds) {
    const node = graph.nodes.find((n) => n.id === breakId)!;
    const def = getNodeDefinition('break')!;
    const incoming = graph.edges.filter((e) => e.target === breakId);
    const inputs: Record<string, unknown> = {};
    for (const edge of incoming) {
      const src = bodyOutputsByNode.get(edge.source)
        ?? outputsByNode.get(edge.source)
        ?? (edge.source === controllerId ? controllerOutputs : {});
      inputs[edge.targetHandle] = src[edge.sourceHandle];
    }
    const result: NodeResult = run.nodeResults[breakId];
    result.status = 'running';
    const out = await def.run(node, inputs, { signal, details: {}, apiKey });
    result.input = inputs;
    result.output = out;
    result.status = 'done';
    breakOutputs[breakId] = out;
  }

  return {
    breakOutputs,
    bodyOutputs: Object.fromEntries(bodyOutputsByNode),
    controllerOutputs,
    iterationCount: iteration,
    stopReason,
  };
}
