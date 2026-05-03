import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChatStore } from '@/stores/chat';

vi.mock('@/engine/runner', () => ({
  runGraph: vi.fn(async () => ({
    schemaVersion: 1, id: 'r', graphId: 'g', graphSnapshot: {} as never,
    startedAt: '', endedAt: null, status: 'completed' as const,
    inputs: {}, errors: [],
    nodeResults: {
      out: { nodeId: 'out', status: 'done', details: { value: 'mocked reply' } } as never,
    },
  })),
}));

describe('useChatStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('starts with an empty thread and idle status', () => {
    const chat = useChatStore();
    expect(chat.thread).toEqual([]);
    expect(chat.status).toBe('idle');
  });

  it('clear() empties the thread', () => {
    const chat = useChatStore();
    chat.thread.push({ role: 'user', content: 'hi' });
    chat.clear();
    expect(chat.thread).toEqual([]);
  });

  it('submit() appends user, runs graph, appends assistant from chat-output details.value', async () => {
    const chat = useChatStore();
    const graph = {
      schemaVersion: 1 as const, id: 'g', name: 'g', createdAt: '', updatedAt: '',
      nodes: [
        { id: 'in', type: 'chat-input' as const, position: { x: 0, y: 0 }, config: {} },
        { id: 'out', type: 'chat-output' as const, position: { x: 0, y: 0 }, config: { format: 'markdown' as const } },
      ],
      edges: [],
      containsCustomCode: false,
    };
    await chat.submit({ graph, apiKey: 'k', userMessage: 'hello' });
    expect(chat.thread).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'mocked reply' },
    ]);
    expect(chat.status).toBe('idle');
  });

  it('submit() leaves thread with user-only message on runner error and surfaces error', async () => {
    const { runGraph } = await import('@/engine/runner');
    (runGraph as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(new Error('boom'));
    const chat = useChatStore();
    const graph = {
      schemaVersion: 1 as const, id: 'g', name: 'g', createdAt: '', updatedAt: '',
      nodes: [
        { id: 'in', type: 'chat-input' as const, position: { x: 0, y: 0 }, config: {} },
        { id: 'out', type: 'chat-output' as const, position: { x: 0, y: 0 }, config: { format: 'markdown' as const } },
      ],
      edges: [],
      containsCustomCode: false,
    };
    await chat.submit({ graph, apiKey: 'k', userMessage: 'hi' });
    expect(chat.thread).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Error: boom' },
    ]);
    expect(chat.status).toBe('idle');
  });
});
