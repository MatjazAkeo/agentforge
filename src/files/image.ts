import type { ImageMime } from '@/domain/images';
import { computeTargetDimensions } from '@/domain/images';

const MAX_EDGE_PX = 1568;
const JPEG_QUALITY = 0.85;

export interface OptimizeResult {
  bytes: Uint8Array;
  mime: ImageMime;
  width: number;
  height: number;
  origSizeBytes: number;
  newSizeBytes: number;
}

export async function optimizeImage(input: Uint8Array, _origMime: string): Promise<OptimizeResult> {
  const blob = new Blob([input]);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (e) {
    throw new Error(`Image could not be decoded: ${(e as Error).message}`);
  }

  const { width, height } = computeTargetDimensions(bitmap.width, bitmap.height, MAX_EDGE_PX);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const hasAlpha = detectAlpha(ctx, width, height);
  const outMime: ImageMime = hasAlpha ? 'image/png' : 'image/jpeg';
  const outBlob = await canvas.convertToBlob({
    type: outMime,
    quality: outMime === 'image/jpeg' ? JPEG_QUALITY : undefined,
  });
  const bytes = new Uint8Array(await outBlob.arrayBuffer());

  return {
    bytes,
    mime: outMime,
    width,
    height,
    origSizeBytes: input.byteLength,
    newSizeBytes: bytes.byteLength,
  };
}

function detectAlpha(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number): boolean {
  const sample = ctx.getImageData(0, 0, Math.min(w, 16), Math.min(h, 16));
  for (let i = 3; i < sample.data.length; i += 4) {
    if (sample.data[i] < 255) return true;
  }
  return false;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
