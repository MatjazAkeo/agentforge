import { describe, it, expect } from 'vitest';
import { modelAcceptsImages, resolveImagesPortVisibility } from './vision';
import type { ModelEntry } from '@/stores/settings';

const base: Omit<ModelEntry, 'id' | 'input_modalities'> = {
  displayName: 'Test',
  supportsTools: false,
  supportsJsonMode: false,
  notes: '',
};

const catalogWithImages: ModelEntry[] = [
  { id: 'gpt-vision', ...base, input_modalities: ['text', 'image'] },
  { id: 'gpt-text', ...base, input_modalities: ['text'] },
];

describe('modelAcceptsImages', () => {
  it('returns true when catalog says image in input_modalities', () => {
    expect(modelAcceptsImages('gpt-vision', catalogWithImages)).toBe(true);
  });
  it('returns false when catalog says no image', () => {
    expect(modelAcceptsImages('gpt-text', catalogWithImages)).toBe(false);
  });
  it('returns null for unknown model IDs', () => {
    expect(modelAcceptsImages('mystery-model', catalogWithImages)).toBe(null);
  });
});

describe('resolveImagesPortVisibility', () => {
  it('auto + catalog-known + has image → shown', () => {
    expect(resolveImagesPortVisibility('auto', 'gpt-vision', catalogWithImages)).toBe(true);
  });
  it('auto + catalog-known + no image → hidden', () => {
    expect(resolveImagesPortVisibility('auto', 'gpt-text', catalogWithImages)).toBe(false);
  });
  it('auto + catalog-unknown → shown (default-on)', () => {
    expect(resolveImagesPortVisibility('auto', 'mystery-model', catalogWithImages)).toBe(true);
  });
  it('force-on → shown regardless of catalog', () => {
    expect(resolveImagesPortVisibility('force-on', 'gpt-text', catalogWithImages)).toBe(true);
  });
  it('force-off → hidden regardless of catalog', () => {
    expect(resolveImagesPortVisibility('force-off', 'gpt-vision', catalogWithImages)).toBe(false);
  });
});
