// src/stores/update.ts
//
// Holds the in-flight update state so both the centered modal and the toolbar
// "Update" button can read from a single source. The Update instance from
// @tauri-apps/plugin-updater uses ES private fields (#metadata etc.) which
// blow up when wrapped in Vue's reactive Proxy — store it via shallowRef so
// the prototype is preserved.
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useSettingsStore } from './settings';

export type UpdateStatus = 'idle' | 'downloading' | 'installing' | 'error';

/** Pre-release identifiers we treat as "beta" — any SemVer pre-release
 *  segment matching the conventional unstable-channel keywords. Stable
 *  versions (no pre-release segment) always pass through. */
const BETA_RE = /-(?:beta|alpha|rc|dev|canary)(?:[.\d-].*)?$/i;

export function isBetaVersion(version: string): boolean {
  return BETA_RE.test(version);
}

export const useUpdateStore = defineStore('update', () => {
  const update = shallowRef<Update | null>(null);
  const status = ref<UpdateStatus>('idle');
  const progress = ref(0); // 0..1
  const errorMsg = ref<string | null>(null);
  const modalOpen = ref(false);

  async function checkForUpdate() {
    try {
      const u = await check();
      if (!u || !u.available) return;
      // Skip pre-release builds unless the user explicitly opted in.
      if (isBetaVersion(u.version) && !useSettingsStore().enableBetaUpdates) {
        return;
      }
      update.value = u;
      modalOpen.value = true;
    } catch (e) {
      console.warn('Update check failed:', e);
    }
  }

  async function installAndRestart() {
    if (!update.value) return;
    status.value = 'downloading';
    errorMsg.value = null;
    progress.value = 0;
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

  function openModal() {
    modalOpen.value = true;
  }

  function closeModal() {
    modalOpen.value = false;
  }

  return { update, status, progress, errorMsg, modalOpen, checkForUpdate, installAndRestart, openModal, closeModal };
});
