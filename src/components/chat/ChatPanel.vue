<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useChatStore } from '@/stores/chat';
import { useGraphStore } from '@/stores/graph';
import { useSettingsStore } from '@/stores/settings';
import type { Graph } from '@/domain/graph';
import ChatBubble from './ChatBubble.vue';
import { extractText, extensionOf } from '@/files/extract';
import { optimizeImage, bytesToBase64 } from '@/files/image';
import type { ImageMime } from '@/domain/images';
import ChatAttachmentStrip from './ChatAttachmentStrip.vue';

const chat = useChatStore();
const graphStore = useGraphStore();
const settings = useSettingsStore();

const input = ref('');
const scroller = ref<HTMLDivElement | null>(null);

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['txt', 'json', 'pdf'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const IMAGE_MAX_BYTES = 50 * 1024 * 1024;
const attachError = ref<string | null>(null);

function mimeFromExt(ext: string): ImageMime {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function onSubmit() {
  if (!input.value.trim() || chat.status === 'running') return;
  const text = input.value;
  input.value = '';
  // Build a plain Graph snapshot from store state for the runner.
  // graphStore.graph is the reactive Graph object (Pinia unwraps the ref).
  const g = graphStore.graph;
  const snapshot: Graph = {
    schemaVersion: g.schemaVersion,
    id: g.id,
    name: g.name,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    nodes: g.nodes,
    edges: g.edges,
    containsCustomCode: g.containsCustomCode,
  };
  await chat.submit({ graph: snapshot, apiKey: settings.apiKey ?? '', userMessage: text });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSubmit();
  }
}

async function ingestFile(file: File) {
  attachError.value = null;
  const ext = extensionOf(file.name).toLowerCase();

  if (IMAGE_EXTS.includes(ext)) {
    if (file.size > IMAGE_MAX_BYTES) {
      attachError.value = `${file.name} is over 50 MB — images are capped at 50 MB raw.`;
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const optimized = await optimizeImage(bytes, mimeFromExt(ext));
    const dataUrl = `data:${optimized.mime};base64,${bytesToBase64(optimized.bytes)}`;
    chat.addAttachment({
      kind: 'image',
      filename: file.name,
      dataUrl,
      mime: optimized.mime,
      sizeBytes: optimized.newSizeBytes,
    });
    return;
  }

  if (!ALLOWED.includes(ext)) {
    attachError.value = `${file.name}: only txt / json / pdf / png / jpg / webp supported.`;
    return;
  }
  if (file.size > MAX_BYTES) {
    attachError.value = `${file.name} is over 10 MB.`;
    return;
  }
  const bytes = await file.arrayBuffer();
  const content = await extractText(bytes, ext);
  chat.addAttachment({ kind: 'text', filename: file.name, content, sizeBytes: file.size });
}

function onFiles(fileList: FileList | null) {
  if (!fileList) return;
  for (let i = 0; i < fileList.length; i++) void ingestFile(fileList[i]);
}

async function onPickFiles() {
  const inputEl = document.createElement('input');
  inputEl.type = 'file';
  inputEl.multiple = true;
  inputEl.accept = '.txt,.json,.pdf,.png,.jpg,.jpeg,.webp';
  inputEl.onchange = () => onFiles(inputEl.files);
  inputEl.click();
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer?.files) onFiles(e.dataTransfer.files);
}

function onPaste(e: ClipboardEvent) {
  if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
    e.preventDefault();
    onFiles(e.clipboardData.files);
  }
}

watch(
  () => [chat.thread.length, chat.status],
  async () => {
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
);
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between px-3 py-2 border-b border-border-base">
      <strong class="text-xs uppercase tracking-wide opacity-70">Chat</strong>
      <button
        type="button"
        @click="chat.clear()"
        class="text-text-dim hover:text-text-base text-[11px]"
        :disabled="chat.status === 'running'"
      >Clear</button>
    </div>

    <div ref="scroller" class="flex-1 overflow-y-auto p-3">
      <div v-if="chat.thread.length === 0" class="text-center opacity-50 text-xs italic mt-8">
        No messages yet. Type below to start a turn.
      </div>
      <ChatBubble
        v-for="(t, i) in chat.thread"
        :key="i"
        :role="t.role"
        :content="t.content"
        :attachments="t.attachments"
      />
      <div v-if="chat.status === 'running'" class="text-text-dim italic text-xs px-1 mb-2">
        running…
      </div>
    </div>

    <div class="border-t border-border-base p-2">
      <ChatAttachmentStrip />
      <div v-if="attachError" class="text-error text-[11px] px-2 pb-1">{{ attachError }}</div>
      <div class="flex gap-1.5 items-end">
        <textarea
          v-model="input"
          @keydown="onKeydown"
          @drop="onDrop"
          @dragover.prevent
          @paste="onPaste"
          placeholder="Type a message — Enter to send, Shift+Enter for newline. Drop files / images here, or click +."
          rows="2"
          class="flex-1 min-h-[40px] bg-elev text-text-base border border-border-base rounded-md px-2.5 py-2 text-sm font-ui resize-none leading-snug focus:outline-none focus:border-accent/60"
          :disabled="chat.status === 'running'"
        ></textarea>
        <button
          type="button"
          @click="onPickFiles"
          class="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md border border-border-strong bg-elev text-text-base text-lg leading-none hover:bg-panel disabled:opacity-50 disabled:cursor-default"
          :disabled="chat.status === 'running'"
          title="Attach a file"
          aria-label="Attach a file"
        >+</button>
      </div>
    </div>
  </div>
</template>
