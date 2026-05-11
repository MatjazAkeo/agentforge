import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGraphStore } from '@/stores/graph';

describe('graph store — orphan edge pruning on File Input image removal', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('removes edges sourced from images port when all image files are removed', () => {
    const g = useGraphStore();
    g.addNode({ id: 'fi', type: 'file-input', position: { x: 0, y: 0 },
      config: { files: [{ filename: 'a.jpg', sizeBytes: 1, kind: 'image', mime: 'image/jpeg' }] } });
    g.addNode({ id: 'lc', type: 'llm-call', position: { x: 100, y: 0 }, config: { model: 'm' } });
    g.addEdge({ id: 'e1', source: 'fi', sourceHandle: 'images', target: 'lc', targetHandle: 'images' });
    expect(g.edges).toHaveLength(1);

    g.updateNodeConfig('fi', { files: [] });
    expect(g.edges).toHaveLength(0);
  });

  it('keeps unrelated edges when images files are removed', () => {
    const g = useGraphStore();
    g.addNode({ id: 'fi', type: 'file-input', position: { x: 0, y: 0 },
      config: { files: [{ filename: 'a.jpg', sizeBytes: 1, kind: 'image', mime: 'image/jpeg' }, { filename: 't.txt', sizeBytes: 1, kind: 'text' }] } });
    g.addNode({ id: 'lc', type: 'llm-call', position: { x: 100, y: 0 }, config: { model: 'm' } });
    g.addEdge({ id: 'eImg', source: 'fi', sourceHandle: 'images', target: 'lc', targetHandle: 'images' });
    g.addEdge({ id: 'eText', source: 'fi', sourceHandle: 'text', target: 'lc', targetHandle: 'text' });

    g.updateNodeConfig('fi', { files: [{ filename: 't.txt', sizeBytes: 1, kind: 'text' }] });
    expect(g.edges.find(e => e.id === 'eImg')).toBeUndefined();
    expect(g.edges.find(e => e.id === 'eText')).toBeDefined();
  });
});
