import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { ToolPackConfig, ToolPackTool } from '@/domain/node-types';
import type { ToolDefinitionPayload } from './tool';
import { getFlavor } from '@/flavors/registry';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Side-channel — Tool Runner consults this to get the right helper for a
 *  tool whose toolId is `<tool-pack-node-id>/<toolName>`. Keyed by Tool Pack
 *  node id. Reset when the graph is reloaded. */
export const toolPackHelperFactories = new Map<
  string,
  (toolName: string) => Promise<{
    name: string;
    impl: { [m: string]: (...a: unknown[]) => Promise<unknown> };
  }>
>();

export const toolPackNode: NodeDefinition = {
  type: 'tool-pack',
  inputPorts: [],
  outputPorts: ['tools'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as ToolPackConfig;
    const flavor = getFlavor(cfg.flavor);
    if (!flavor) {
      throw new Error(`tool-pack: unknown flavor "${cfg.flavor}"`);
    }

    const nodeId = node.id;
    const graphFilePath = ctx.graphFilePath;

    // Each configured tool becomes a ToolDefinitionPayload. The actual helper
    // for the body is built at call time via the side-channel below — this
    // run() just emits the descriptor list.
    const payloads: ToolDefinitionPayload[] = (cfg.tools ?? []).map((t: ToolPackTool) => ({
      toolId: `${nodeId}/${t.name}`,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
      code: t.code,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    }));

    // Stash a closure on the runtime registry so tool-runner can find the
    // matching flavor builder when this node's tools are executed.
    toolPackHelperFactories.set(nodeId, async (toolName: string) => {
      const tool = (cfg.tools ?? []).find((t) => t.name === toolName);
      const maxRows = tool?.maxRows;
      // SQLite-specific signature: (connection, nodeId, graphFilePath, maxRows?)
      // The variadic registry interface accepts these as ...rest.
      const helper = await flavor.buildHelper(
        cfg.connection,
        nodeId,
        graphFilePath,
        maxRows,
      );
      return { name: flavor.helperName, impl: helper };
    });

    ctx.details.toolCount = payloads.length;
    ctx.details.flavor = cfg.flavor;
    return { tools: payloads };
  },
};

registerNodeDefinition(toolPackNode);
