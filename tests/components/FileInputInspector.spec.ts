import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FileInputInspector from '@/components/inspectors/FileInputInspector.vue';
import { useGraphStore } from '@/stores/graph';
import type { Graph } from '@/domain/graph';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({ stat: vi.fn() }));
vi.mock('@/persistence/assets-dir', () => ({
  copyToAssets: vi.fn(),
  removeAsset: vi.fn(),
  assetExists: vi.fn().mockResolvedValue(true),
}));

beforeEach(() => setActivePinia(createPinia()));

function makeGraph(_filePath: string | null = '/u/m/proj.graph.json'): Graph {
  return {
    schemaVersion: 1, id: 'g', name: 'g',
    createdAt: '', updatedAt: '',
    nodes: [
      { id: 'n', type: 'file-input', position: { x: 0, y: 0 },
        config: { files: [{ filename: 'notes.txt', sizeBytes: 42, sourcePath: '/src/notes.txt' }] } },
    ],
    edges: [],
    containsCustomCode: false,
  } as Graph;
}

describe('FileInputInspector', () => {
  it('renders the file list', () => {
    const g = useGraphStore();
    g.load(makeGraph(), '/u/m/proj.graph.json');
    const w = mount(FileInputInspector, { props: { nodeId: 'n' } });
    expect(w.text()).toContain('notes.txt');
    expect(w.text()).toContain('42 B');
  });

  it('shows the Add button', () => {
    const g = useGraphStore();
    g.load(makeGraph(), '/u/m/proj.graph.json');
    const w = mount(FileInputInspector, { props: { nodeId: 'n' } });
    const addBtn = w.findAll('button').find((b) => b.text().includes('Add'));
    expect(addBtn).toBeTruthy();
    expect(addBtn!.text()).toContain('Add file');
  });

  it('warns if the graph is unsaved', async () => {
    const g = useGraphStore();
    g.load(makeGraph(null), null);
    const w = mount(FileInputInspector, { props: { nodeId: 'n' } });
    const addBtn = w.findAll('button').find((b) => b.text().includes('Add'))!;
    await addBtn.trigger('click');
    expect(w.text()).toContain('Save the graph first');
  });
});
