<script setup lang="ts">
import { onMounted } from 'vue';
import { useUpdateStore } from '@/stores/update';

const updateStore = useUpdateStore();

onMounted(() => {
  void updateStore.checkForUpdate();
});

function onBackdropClick() {
  if (updateStore.status === 'idle' || updateStore.status === 'error') {
    updateStore.closeModal();
  }
}
</script>

<template>
  <div
    v-if="updateStore.modalOpen && updateStore.update"
    class="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center"
    @click.self="onBackdropClick"
  >
    <div class="bg-panel-strong border border-border-strong rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
      <div class="px-4 py-3 border-b border-border-base flex items-center justify-between">
        <strong>Update available</strong>
        <button
          v-if="updateStore.status === 'idle' || updateStore.status === 'error'"
          type="button"
          @click="updateStore.closeModal()"
          class="bg-transparent border-0 text-text-dim hover:text-text-base cursor-pointer text-xl leading-none"
        >×</button>
      </div>

      <div class="px-4 py-3 flex flex-col gap-3 overflow-y-auto">
        <div class="text-text-dim text-sm">
          Version <span class="font-mono text-text-base">{{ updateStore.update.version }}</span> is available
          (you're on <span class="font-mono">{{ updateStore.update.currentVersion }}</span>).
        </div>

        <div
          v-if="updateStore.update.body"
          class="text-xs opacity-85 max-h-[220px] overflow-y-auto whitespace-pre-wrap bg-elev rounded p-3 border border-border-base"
        >{{ updateStore.update.body }}</div>

        <div v-if="updateStore.status === 'idle'" class="flex gap-2 pt-1">
          <button
            type="button"
            @click="updateStore.installAndRestart()"
            class="flex-1 bg-accent text-white border border-accent rounded px-3 py-2 cursor-pointer hover:opacity-90 font-semibold"
          >Install and restart</button>
          <button
            type="button"
            @click="updateStore.closeModal()"
            class="bg-elev text-text-base border border-border-strong rounded px-3 py-2 cursor-pointer"
          >Later</button>
        </div>

        <div v-else-if="updateStore.status === 'downloading'" class="flex flex-col gap-1.5">
          <div class="text-xs opacity-70">Downloading…</div>
          <div class="h-1.5 bg-elev rounded overflow-hidden">
            <div class="h-full bg-accent transition-[width]" :style="{ width: `${Math.round(updateStore.progress * 100)}%` }" />
          </div>
        </div>

        <div v-else-if="updateStore.status === 'installing'" class="text-xs opacity-70">
          Installing — restarting in a moment…
        </div>

        <div v-else-if="updateStore.status === 'error'" class="flex flex-col gap-2">
          <div class="text-error text-xs">Update failed: {{ updateStore.errorMsg }}</div>
          <button
            type="button"
            @click="updateStore.installAndRestart()"
            class="bg-elev text-text-base border border-border-strong rounded px-3 py-1.5 cursor-pointer text-xs self-start"
          >Retry</button>
        </div>
      </div>
    </div>
  </div>
</template>
