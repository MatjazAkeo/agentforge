import type { ModelEntry } from '@/stores/settings';

export type ImagesPortMode = 'auto' | 'force-on' | 'force-off';

/**
 * Returns true when the catalog explicitly lists 'image' in input_modalities,
 * false when it explicitly does not, null when the model is unknown to the catalog.
 */
export function modelAcceptsImages(modelId: string, catalog: ModelEntry[]): boolean | null {
  const m = catalog.find((x) => x.id === modelId);
  if (!m) return null;
  const mods = m.input_modalities;
  if (!Array.isArray(mods)) return null;
  return mods.includes('image');
}

export function resolveImagesPortVisibility(
  mode: ImagesPortMode,
  modelId: string,
  catalog: ModelEntry[],
): boolean {
  if (mode === 'force-on') return true;
  if (mode === 'force-off') return false;
  const cap = modelAcceptsImages(modelId, catalog);
  if (cap === null) return true;
  return cap;
}
