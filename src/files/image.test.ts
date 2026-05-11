import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeTargetDimensions } from '@/domain/images';
import { optimizeImage } from './image';

describe('computeTargetDimensions', () => {
  it('clamps the longer edge of a landscape image to maxEdge, preserving ratio', () => {
    expect(computeTargetDimensions(4032, 3024, 1568)).toEqual({ width: 1568, height: 1176 });
  });
  it('clamps the longer edge of a portrait image to maxEdge, preserving ratio', () => {
    expect(computeTargetDimensions(2000, 3000, 1568)).toEqual({ width: 1045, height: 1568 });
  });
  it('leaves smaller images at their original dimensions', () => {
    expect(computeTargetDimensions(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });
  it('keeps square images square', () => {
    expect(computeTargetDimensions(2048, 2048, 1568)).toEqual({ width: 1568, height: 1568 });
  });
});

describe('optimizeImage', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn(async (_blob: Blob) => ({
      width: 4032,
      height: 3024,
      close: vi.fn(),
    })));

    class FakeOffscreenCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) { this.width = w; this.height = h; }
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]),
          })),
        };
      }
      async convertToBlob(opts: { type: string; quality?: number }) {
        return new Blob([new Uint8Array([1, 2, 3])], { type: opts.type });
      }
    }
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resizes a 4032x3024 image to 1568x1176 and emits JPEG (no alpha)', async () => {
    const input = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const out = await optimizeImage(input, 'image/jpeg');
    expect(out.width).toBe(1568);
    expect(out.height).toBe(1176);
    expect(out.mime).toBe('image/jpeg');
    expect(out.origSizeBytes).toBe(4);
    expect(out.newSizeBytes).toBe(3);
  });

  it('emits PNG when source has alpha', async () => {
    vi.stubGlobal('OffscreenCanvas', class {
      width = 100; height = 100;
      constructor(w: number, h: number) { this.width = w; this.height = h; }
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray([0, 0, 0, 128, 0, 0, 0, 255]),
          })),
        };
      }
      async convertToBlob(opts: { type: string }) {
        return new Blob([new Uint8Array([9, 9, 9])], { type: opts.type });
      }
    });
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })));

    const out = await optimizeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/png');
    expect(out.mime).toBe('image/png');
  });

  it('throws a descriptive error if decode fails', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode failed'); }));
    await expect(optimizeImage(new Uint8Array([0]), 'image/jpeg')).rejects.toThrow(/could not be decoded/i);
  });
});
