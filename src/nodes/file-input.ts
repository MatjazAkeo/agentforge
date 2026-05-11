import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { FileInputConfig } from '@/domain/node-types';
import type { ImageRef, ImageMime } from '@/domain/images';
import { readAssetBytes, assetExists } from '@/persistence/assets-dir';
import { extractText, extensionOf } from '@/files/extract';
import { wrapFileBlock, concatFileBlocks } from '@/files/wrapping';

export const fileInputNode: NodeDefinition = {
  type: 'file-input',
  inputPorts: [],
  outputPorts: ['text', 'images'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as FileInputConfig;
    const files = cfg.files ?? [];

    const textFiles = files.filter((f) => (f.kind ?? 'text') === 'text');
    const imageFiles = files.filter((f) => f.kind === 'image');

    if (files.length === 0) {
      ctx.details.fileCount = 0;
      return { text: '' };
    }

    if (!ctx.graphFilePath) {
      throw new Error('file-input: save the graph first — file inputs need a saved location to find their side-car directory.');
    }

    const out: { text?: string; images?: ImageRef[] } = {};

    if (textFiles.length > 0) {
      const blocks: string[] = [];
      const emptyFiles: string[] = [];
      for (const f of textFiles) {
        if (!(await assetExists(ctx.graphFilePath, f.filename))) {
          throw new Error(`file-input: missing asset ${f.filename} — was the assets folder moved?`);
        }
        const bytes = await readAssetBytes(ctx.graphFilePath, f.filename);
        const ext = extensionOf(f.filename);
        const content = await extractText(bytes, ext);
        if (content.trim().length === 0) emptyFiles.push(f.filename);
        blocks.push(wrapFileBlock(f.filename, content));
      }
      out.text = concatFileBlocks(blocks);
      ctx.details.emptyFiles = emptyFiles;
      ctx.details.charCount = blocks.reduce((sum, b) => sum + b.length, 0);
    }

    if (imageFiles.length > 0) {
      out.images = imageFiles.map((f): ImageRef => ({
        kind: 'asset',
        filename: f.filename,
        mime: (f.mime ?? 'image/jpeg') as ImageMime,
      }));
    }

    ctx.details.fileCount = files.length;
    ctx.details.imageCount = imageFiles.length;
    return out;
  },
};

registerNodeDefinition(fileInputNode);
