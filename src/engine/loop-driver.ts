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
  // I4: use nodeById map for O(1) lookups
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const id of reachable) {
    const node = nodeById.get(id);
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

  // I4: build nodeById map once for O(1) lookups throughout driveLoop
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const controllerNode = nodeById.get(controllerId);
  if (!controllerNode) throw new Error(`Node "${controllerId}" not found in graph`);

  const cfg = controllerNode.config as LoopControllerConfig;
  const body = computeLoopBody(graph, controllerId);

  // I4: convert bodyNodeIds to a Set for O(1) membership checks
  const bodySet = new Set(body.bodyNodeIds);

  // I1: guard loop-controller definition lookup
  const ctrlDef = getNodeDefinition('loop-controller');
  if (!ctrlDef) throw new Error('No definition registered for node type "loop-controller"');

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
  let completedIterations = 0;
  let stopReason: LoopDriverResult['stopReason'] = 'continue-false';
  let bodyOutputsByNode = new Map<string, Record<string, unknown>>();
  let controllerOutputs: Record<string, unknown> = {};
  let cycledChannelValues: Record<string, unknown> = {};
  let lastContinue: unknown = false;

  // Topological order *within* the body (using internalEdges only).
  const bodyOrder = topologicalOrder({
    ...graph,
    nodes: graph.nodes.filter((n) => bodySet.has(n.id) || n.id === controllerId),
    edges: body.internalEdges,
  });

  // Pre-init iterations arrays on body nodes and the controller.
  for (const id of [...body.bodyNodeIds, controllerId]) {
    if (!run.nodeResults[id].iterations) run.nodeResults[id].iterations = [];
  }

  // I3: record when the driver started running the controller node.
  const driverStart = new Date().toISOString();
  run.nodeResults[controllerId].startedAt = driverStart;

  // C1: outer try/catch to ensure controller status is always updated on error
  try {
    while (true) {
      if (signal.aborted) { stopReason = 'aborted'; break; }
      if (iteration > cfg.maxIterations) { stopReason = 'max-iterations'; break; }

      // 1) Run the controller for this iteration.
      const ctrlResult: NodeResult = run.nodeResults[controllerId];
      ctrlResult.status = 'running';
      const ctrlInputs: Record<string, unknown> = { ...initialInputs, iteration };
      for (const [k, v] of Object.entries(cycledChannelValues)) ctrlInputs[k] = v;
      const ctrlIterDetails: Record<string, unknown> = {};
      let ctrlOut: Record<string, unknown>;
      // M1: capture start before await so startedAt reflects the actual start time
      const ctrlStart = new Date().toISOString();
      try {
        ctrlOut = await ctrlDef.run(controllerNode, ctrlInputs, {
          signal, details: ctrlIterDetails, apiKey,
        });
      } catch (e) {
        ctrlResult.status = 'error';
        ctrlResult.errorMessage = (e as Error).message;
        // C1: push partial IterationRecord before re-throwing
        ctrlResult.iterations!.push({
          iteration, startedAt: ctrlStart, endedAt: new Date().toISOString(),
          inputs: JSON.parse(JSON.stringify(ctrlInputs)),
          details: { error: (e as Error).message },
        });
        throw e;
      }
      ctrlResult.iterations!.push({
        iteration, startedAt: ctrlStart,
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
        if (!bodySet.has(id)) continue;
        if (signal.aborted) { stopReason = 'aborted'; break; }

        const node = nodeById.get(id);
        if (!node) throw new Error(`Body node "${id}" not found in graph`);
        // I1: guard body node definition lookup
        const def = getNodeDefinition(node.type);
        if (!def) throw new Error(`No definition registered for node type "${node.type}"`);

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
        // I3: record startedAt on first iteration only (??= keeps earliest timestamp).
        result.startedAt = result.startedAt ?? iterStart;
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
          // I3: update endedAt after every successful iteration so it reflects the last completion.
          result.endedAt = new Date().toISOString();
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
          // I3: record endedAt on error path too.
          result.endedAt = new Date().toISOString();
          args.clearLivePreview?.(id);
          // C1: push partial IterationRecord before re-throwing so we don't lose the input
          result.iterations!.push({
            iteration, startedAt: iterStart, endedAt: new Date().toISOString(),
            inputs: JSON.parse(JSON.stringify(inputs)),
            details: { error: (e as Error).message },
          });
          throw e;
        }
      }

      // C1: if the signal was aborted mid-body, exit the outer loop immediately before
      // doing back-edge reads or the halt check — prevents one extra LLM call.
      if (signal.aborted) { stopReason = 'aborted'; break; }

      // C2: track completed iterations — "this iteration's body ran to completion"
      completedIterations = iteration;

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
  } catch (e) {
    // C1: on any error, set controller to error state and re-throw.
    // Break-node firing is skipped on the error path.
    const ctrl: NodeResult = run.nodeResults[controllerId];
    ctrl.status = 'error';
    ctrl.details.stopReason = 'error';
    ctrl.details.iterationCount = completedIterations;
    // I3: record endedAt on error path.
    ctrl.endedAt = new Date().toISOString();
    throw e;
  }

  // Mark controller done and stash stop reason.
  // This block is only reached on success paths (continue-false, max-iterations, aborted).
  // M7: error path is handled by the outer catch block above and re-throws before reaching here.
  // stopReason is never 'error' at this point — that path always re-throws above.
  const ctrl: NodeResult = run.nodeResults[controllerId];
  ctrl.status = 'done';
  ctrl.details.stopReason = stopReason;
  // C2: use completedIterations for accurate reporting (not the loop counter `iteration`)
  ctrl.details.iterationCount = completedIterations;
  // I3: record endedAt on success paths.
  ctrl.endedAt = new Date().toISOString();

  // 5) Fire break nodes once with the latest body outputs.
  const breakOutputs: Record<string, Record<string, unknown>> = {};
  for (const breakId of body.breakNodeIds) {
    const node = nodeById.get(breakId);
    if (!node) throw new Error(`Break node "${breakId}" not found in graph`);
    // I1: guard break node definition lookup
    const def = getNodeDefinition('break');
    if (!def) throw new Error('No definition registered for node type "break"');

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
    // I3: record startedAt for break nodes.
    result.startedAt = new Date().toISOString();
    const out = await def.run(node, inputs, { signal, details: {}, apiKey });
    result.input = inputs;
    result.output = out;
    result.status = 'done';
    // I3: record endedAt for break nodes.
    result.endedAt = new Date().toISOString();
    breakOutputs[breakId] = out;
  }

  return {
    breakOutputs,
    bodyOutputs: Object.fromEntries(bodyOutputsByNode),
    controllerOutputs,
    // C2: return completedIterations for accurate count
    iterationCount: completedIterations,
    stopReason,
  };
}
