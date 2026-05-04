import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Graph } from '@/domain/graph';
import type { ChatMessage } from '@/openrouter/types';
import { runGraph } from '@/engine/runner';
import { wrapFileBlock, concatFileBlocks } from '@/files/wrapping';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatAttachment {
  filename: string;
  content: string; // already-extracted text
  sizeBytes: number;
}

export const useChatStore = defineStore('chat', () => {
  const thread = ref<ChatTurn[]>([]);
  const status = ref<'idle' | 'running'>('idle');
  const attachments = ref<ChatAttachment[]>([]);

  function addAttachment(a: ChatAttachment) {
    attachments.value = [...attachments.value, a];
  }
  function removeAttachment(index: number) {
    attachments.value = attachments.value.filter((_, i) => i !== index);
  }
  function clearAttachments() {
    attachments.value = [];
  }
  function composeUserMessage(userText: string): string {
    if (attachments.value.length === 0) return userText;
    const wrapped = concatFileBlocks(
      attachments.value.map((a) => wrapFileBlock(a.filename, a.content)),
    );
    return `${userText}\n\n${wrapped}`;
  }

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

    const composedText = composeUserMessage(text);

    thread.value.push({ role: 'user', content: composedText });
    status.value = 'running';

    // Build the ChatMessage[] history (sidebar uses {role, content}; LLMs need ChatMessage).
    const history: ChatMessage[] = thread.value.map((t) => ({ role: t.role, content: t.content }));

    try {
      const run = await runGraph({
        graph: args.graph,
        apiKey: args.apiKey,
        chatSession: { userMessage: composedText, history },
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
      clearAttachments();
    }
  }

  return {
    thread,
    status,
    attachments,
    clear,
    isChatActive,
    submit,
    addAttachment,
    removeAttachment,
    clearAttachments,
    composeUserMessage,
  };
});
