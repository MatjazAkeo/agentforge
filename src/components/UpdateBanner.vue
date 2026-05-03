<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const update = ref<Update | null>(null);
const status = ref<'idle' | 'downloading' | 'installing' | 'error'>('idle');
const progress = ref(0); // 0..1
const errorMsg = ref<string | null>(null);

async function checkForUpdate() {
  try {
    const u = await check();
    if (u && u.available) {
      update.value = u;
    }
  } catch (e) {
    // Failures here are non-fatal (no internet, no release yet, etc.) — don't
    // surface to the user. The banner just doesn't appear.
    console.warn('Update check failed:', e);
  }
}

async function installAndRestart() {
  if (!update.value) return;
  status.value = 'downloading';
  errorMsg.value = null;
  let total = 0;
  let downloaded = 0;
  try {
    await update.value.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength ?? 0;
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          if (total > 0) progress.value = downloaded / total;
          break;
        case 'Finished':
          status.value = 'installing';
          break;
      }
    });
    await relaunch();
  } catch (e) {
    status.value = 'error';
    errorMsg.value = (e as Error).message;
  }
}

function dismiss() {
  update.value = null;
}

onMounted(() => {
  // Fire-and-forget — don't block UI rendering on the network call.
  void checkForUpdate();
});
</script>

<template>
  <div
    v-if="update"
    class="fixed top-3 right-3 z-[3000] w-[340px] bg-panel-strong border border-accent rounded-lg shadow-2xl text-sm"
  >
    <div class="px-3 py-2 border-b border-border-base flex items-center justify-between">
      <strong class="text-text-base">Update available</strong>
      <button
        v-if="status === 'idle' || status === 'error'"
        type="button" @click="dismiss"
        class="bg-transparent border-0 text-text-dim hover:text-text-base cursor-pointer text-base leading-none"
      >×</button>
    </div>
    <div class="px-3 py-2.5 flex flex-col gap-2">
      <div class="text-text-dim text-xs">
        Version <span class="font-mono">{{ update.version }}</span> is available
        (you're on <span class="font-mono">{{ update.currentVersion }}</span>).
      </div>
      <div v-if="update.body" class="text-[11px] opacity-70 max-h-[120px] overflow-y-auto whitespace-pre-wrap">{{ update.body }}</div>

      <div v-if="status === 'idle'" class="flex gap-2">
        <button
          type="button" @click="installAndRestart"
          class="flex-1 bg-accent text-white border border-accent rounded px-3 py-1.5 cursor-pointer text-xs hover:opacity-90"
        >Install and restart</button>
        <button
          type="button" @click="dismiss"
          class="bg-elev text-text-base border border-border-strong rounded px-3 py-1.5 cursor-pointer text-xs"
        >Later</button>
      </div>

      <div v-else-if="status === 'downloading'" class="flex flex-col gap-1.5">
        <div class="text-[11px] opacity-70">Downloading…</div>
        <div class="h-1.5 bg-elev rounded overflow-hidden">
          <div class="h-full bg-accent transition-[width]" :style="{ width: `${Math.round(progress * 100)}%` }"></div>
        </div>
      </div>

      <div v-else-if="status === 'installing'" class="text-[11px] opacity-70">Installing — restarting in a moment…</div>

      <div v-else-if="status === 'error'" class="flex flex-col gap-1.5">
        <div class="text-error text-[11px]">Update failed: {{ errorMsg }}</div>
        <button
          type="button" @click="installAndRestart"
          class="bg-elev text-text-base border border-border-strong rounded px-2 py-1 cursor-pointer text-[11px]"
        >Retry</button>
      </div>
    </div>
  </div>
</template>
