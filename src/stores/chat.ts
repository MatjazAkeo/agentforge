import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Graph } from '@/domain/graph';
import type { ChatMessage } from '@/openrouter/types';
import { runGraph } from '@/engine/runner';
import { wrapFileBlock, concatFileBlocks } from '@/files/wrapping';

export interface ChatAttachment {
  filename: string;
  content: string; // already-extracted text
  sizeBytes: number;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  /** The user's typed text (or assistant reply). UI bubbles render this. */
  content: string;
  /** Files attached to this turn at send time. The UI renders these as chips
   *  below the bubble; the LLM history-builder re-composes them into the
   *  user-role message content via concatFileBlocks(wrapFileBlock(...)). */
  attachments?: ChatAttachment[];
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
  /** Re-compose what the model should see for a single user turn. Combines
   *  the typed text with each attachment wrapped as <file>…</file>. The chat
   *  bubble renders only `content`; this function is the bridge to the LLM. */
  function composeTurnForLLM(turn: ChatTurn): string {
    if (turn.role !== 'user' || !turn.attachments || turn.attachments.length === 0) {
      return turn.content;
    }
    const wrapped = concatFileBlocks(
      turn.attachments.map((a) => wrapFileBlock(a.filename, a.content)),
    );
    return `${turn.content}\n\n${wrapped}`;
  }

  async function submit(args: { graph: Graph; apiKey: string; userMessage: string }) {
    const text = args.userMessage.trim();
    if (!text || status.value === 'running') return;

    // Snapshot attachments at send time so they persist on the turn (the
    // store's own attachments ref will be cleared in `finally`).
    const turnAttachments: ChatAttachment[] | undefined =
      attachments.value.length > 0 ? attachments.value.map((a) => ({ ...a })) : undefined;

    const userTurn: ChatTurn = { role: 'user', content: text, attachments: turnAttachments };
    thread.value.push(userTurn);
    status.value = 'running';

    // Build the ChatMessage[] history. Each user turn re-composes its
    // attachments inline; assistant turns pass through unchanged.
    const history: ChatMessage[] = thread.value.map((t) => ({
      role: t.role,
      content: composeTurnForLLM(t),
    }));

    try {
      const run = await runGraph({
        graph: args.graph,
        apiKey: args.apiKey,
        chatSession: { userMessage: composeTurnForLLM(userTurn), history },
      });
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
