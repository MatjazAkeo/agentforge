export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface TargetDimensions {
  width: number;
  height: number;
}

export function computeTargetDimensions(
  origWidth: number,
  origHeight: number,
  maxEdge: number,
): TargetDimensions {
  const longest = Math.max(origWidth, origHeight);
  if (longest <= maxEdge) return { width: origWidth, height: origHeight };
  const scale = maxEdge / longest;
  return {
    width: Math.round(origWidth * scale),
    height: Math.round(origHeight * scale),
  };
}
