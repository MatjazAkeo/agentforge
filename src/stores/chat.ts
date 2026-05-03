import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Graph } from '@/domain/graph';
import type { ChatMessage } from '@/openrouter/types';
import { runGraph } from '@/engine/runner';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const useChatStore = defineStore('chat', () => {
  const thread = ref<ChatTurn[]>([]);
  const status = ref<'idle' | 'running'>('idle');

  function clear() {
    thread.value = [];
  }

  /**
   * Returns true if `graph` is a chat-active graph: has exactly one chat-input
   * AND exactly one chat-output node.
   */
  function isChatActive(graph: Graph | null): boolean {
    if (!graph) return false;
    const ins = graph.nodes.filter((n) => n.type === 'chat-input').length;
    const outs = graph.nodes.filter((n) => n.type === 'chat-output').length;
    return ins === 1 && outs === 1;
  }

  /**
   * Append the user message, run the graph, append the assistant reply (or error).
   */
  async function submit(args: { graph: Graph; apiKey: string; userMessage: string }) {
    const text = args.userMessage.trim();
    if (!text || status.value === 'running') return;

    thread.value.push({ role: 'user', content: text });
    status.value = 'running';

    // Build the ChatMessage[] history (sidebar uses {role, content}; LLMs need ChatMessage).
    const history: ChatMessage[] = thread.value.map((t) => ({ role: t.role, content: t.content }));

    try {
      const run = await runGraph({
        graph: args.graph,
        apiKey: args.apiKey,
        chatSession: { userMessage: text, history },
      });
      // Find the chat-output node and read its recorded value.
      const outId = args.graph.nodes.find((n) => n.type === 'chat-output')?.id;
      const reply =
        outId && run.nodeResults[outId]
          ? String(run.nodeResults[outId].details.value ?? '')
          : '';
      thread.value.push({ role: 'assistant', content: reply || '(no reply)' });
    } catch (e) {
      thread.value.push({ role: 'assistant', content: `Error: ${(e as Error).message}` });
    } finally {
      status.value = 'idle';
    }
  }

  return { thread, status, clear, isChatActive, submit };
});
