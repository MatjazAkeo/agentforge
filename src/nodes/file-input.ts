import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { FileInputConfig } from '@/domain/node-types';
import { readAssetBytes, assetExists } from '@/persistence/assets-dir';
import { extractText, extensionOf } from '@/files/extract';
import { wrapFileBlock, concatFileBlocks } from '@/files/wrapping';

export const fileInputNode: NodeDefinition = {
  type: 'file-input',
  inputPorts: [],
  outputPorts: ['text'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as FileInputConfig;
    const files = cfg.files ?? [];
    if (files.length === 0) {
      ctx.details.fileCount = 0;
      return { text: '' };
    }

    if (!ctx.graphFilePath) {
      throw new Error('file-input: save the graph first — file inputs need a saved location to find their side-car directory.');
    }

    const blocks: string[] = [];
    const emptyFiles: string[] = [];

    for (const f of files) {
      if (!(await assetExists(ctx.graphFilePath, f.filename))) {
        throw new Error(`file-input: missing asset ${f.filename} — was the assets folder moved?`);
      }
      const bytes = await readAssetBytes(ctx.graphFilePath, f.filename);
      const ext = extensionOf(f.filename);
      const content = await extractText(bytes, ext);
      if (content.trim().length === 0) emptyFiles.push(f.filename);
      blocks.push(wrapFileBlock(f.filename, content));
    }

    ctx.details.fileCount = files.length;
    ctx.details.emptyFiles = emptyFiles;
    ctx.details.charCount = blocks.reduce((sum, b) => sum + b.length, 0);

    return { text: concatFileBlocks(blocks) };
  },
};

registerNodeDefinition(fileInputNode);
