// src/persistence/tauri-fs.ts
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export async function pickGraphFileToOpen(): Promise<string | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'Graph', extensions: ['json'] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export async function pickGraphFileToSave(suggestedName = 'untitled.graph.json'): Promise<string | null> {
  const path = await saveDialog({
    defaultPath: suggestedName,
    filters: [{ name: 'Graph', extensions: ['json'] }],
  });
  return path ?? null;
}

export async function readGraphFile(path: string): Promise<string> {
  return await readTextFile(path);
}

export async function writeGraphFile(path: string, contents: string): Promise<void> {
  await writeTextFile(path, contents);
}
