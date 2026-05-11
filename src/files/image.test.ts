import { describe, it, expect } from 'vitest';
import { computeTargetDimensions } from '@/domain/images';

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
