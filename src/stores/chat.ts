import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Graph } from '@/domain/graph';
import type { Context, ContentPart } from '@/openrouter/types';
import type { ImageMime } from '@/domain/images';
import { runGraph } from '@/engine/runner';
import { wrapFileBlock, concatFileBlocks } from '@/files/wrapping';

export type ChatAttachment =
  | { kind: 'text'; filename: string; content: string; sizeBytes: number }
  | { kind: 'image'; filename: string; dataUrl: string; mime: ImageMime; sizeBytes: number };

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
    const textAtts = attachments.value.filter(
      (a): a is Extract<ChatAttachment, { kind: 'text' }> => a.kind === 'text',
    );
    if (textAtts.length === 0) return userText;
    const wrapped = concatFileBlocks(textAtts.map((a) => wrapFileBlock(a.filename, a.content)));
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
   *  the typed text with text-kind attachments wrapped as <file>…</file>. The
   *  chat bubble renders only `content`; this function is the bridge to the
   *  LLM for the plain-text fold. Image attachments are handled separately
   *  by buildMessageContent. */
  function composeTurnForLLM(turn: ChatTurn): string {
    if (turn.role !== 'user' || !turn.attachments || turn.attachments.length === 0) {
      return turn.content;
    }
    const textAtts = turn.attachments.filter(
      (a): a is Extract<ChatAttachment, { kind: 'text' }> => a.kind === 'text',
    );
    if (textAtts.length === 0) return turn.content;
    const wrapped = concatFileBlocks(textAtts.map((a) => wrapFileBlock(a.filename, a.content)));
    return `${turn.content}\n\n${wrapped}`;
  }

  function buildMessageContent(turn: ChatTurn): string | ContentPart[] {
    const textContent = composeTurnForLLM(turn);
    if (turn.role !== 'user' || !turn.attachments) return textContent;
    const imageAtts = turn.attachments.filter(
      (a): a is Extract<ChatAttachment, { kind: 'image' }> => a.kind === 'image',
    );
    if (imageAtts.length === 0) return textContent;
    const parts: ContentPart[] = [];
    if (textContent) parts.push({ type: 'text', text: textContent });
    for (const img of imageAtts) parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
    return parts;
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
    // Clear the composer chip strip immediately — the snapshot above already
    // captured the attachments for the turn, so the chips' job is done.
    clearAttachments();
    status.value = 'running';

    // Build the Context[] history. Each user turn re-composes its
    // attachments inline (text only in the string fold; images as ContentPart[]).
    // Assistant turns pass through unchanged.
    const history: Context[] = thread.value.map((t) => ({
      role: t.role,
      content: buildMessageContent(t),
    }));

    try {
      const run = await runGraph({
        graph: args.graph,
        apiKey: args.apiKey,
        chatSession: { history },
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
