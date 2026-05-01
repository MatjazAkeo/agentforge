import { invoke } from '@tauri-apps/api/core';

export async function saveApiKey(key: string): Promise<void> {
  await invoke('save_api_key', { key });
}

export async function loadApiKey(): Promise<string | null> {
  return await invoke<string | null>('load_api_key');
}

export async function deleteApiKey(): Promise<void> {
  await invoke('delete_api_key');
}
