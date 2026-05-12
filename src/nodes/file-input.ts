import { registerNodeDefinition, type NodeDefinition } from './registry';
import type { FileInputConfig } from '@/domain/node-types';
import type { ImageMime } from '@/domain/images';
import { wrapAsContextMixed } from '@/domain/context';
import { readAssetBytes, assetExists } from '@/persistence/assets-dir';
import { bytesToBase64 } from '@/files/image';
import { extractText, extensionOf } from '@/files/extract';
import { wrapFileBlock, concatFileBlocks } from '@/files/wrapping';

export const fileInputNode: NodeDefinition = {
  type: 'file-input',
  inputPorts: [],
  outputPorts: ['context'],
  async run(node, _inputs, ctx) {
    const cfg = node.config as FileInputConfig;
    const files = cfg.files ?? [];

    if (files.length === 0) {
      ctx.details.fileCount = 0;
      return { context: [{ role: 'user' as const, content: '' }] };
    }

    if (!ctx.graphFilePath) {
      throw new Error('file-input: save the graph first — file inputs need a saved location to find their side-car directory.');
    }

    const textFiles = files.filter((f) => (f.kind ?? 'text') === 'text');
    const imageFiles = files.filter((f) => f.kind === 'image');

    let textPortion = '';
    const emptyFiles: string[] = [];
    if (textFiles.length > 0) {
      const blocks: string[] = [];
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
      textPortion = concatFileBlocks(blocks);
    }

    const imageDataUrls: string[] = [];
    for (const f of imageFiles) {
      if (!(await assetExists(ctx.graphFilePath, f.filename))) {
        throw new Error(`file-input: missing asset ${f.filename} — was the assets folder moved?`);
      }
      const bytes = await readAssetBytes(ctx.graphFilePath, f.filename);
      const mime = (f.mime ?? 'image/jpeg') as ImageMime;
      imageDataUrls.push(`data:${mime};base64,${bytesToBase64(new Uint8Array(bytes))}`);
    }

    ctx.details.fileCount = files.length;
    ctx.details.imageCount = imageFiles.length;
    ctx.details.emptyFiles = emptyFiles;
    ctx.details.charCount = textPortion.length;
    return { context: wrapAsContextMixed(textPortion, imageDataUrls) };
  },
};

registerNodeDefinition(fileInputNode);
