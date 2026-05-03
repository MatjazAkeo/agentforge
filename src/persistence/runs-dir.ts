// src/persistence/runs-dir.ts
import { mkdir, readDir, readTextFile, writeTextFile, remove, exists } from '@tauri-apps/plugin-fs';
import { runsFolderForGraph, serializeRun, parseRun, runFileName } from './run-io';
import type { Run } from '@/domain/run';

export async function ensureRunsFolder(graphFilePath: string): Promise<string> {
  const folder = runsFolderForGraph(graphFilePath);
  if (!(await exists(folder))) await mkdir(folder, { recursive: true });
  return folder;
}

export async function writeRun(graphFilePath: string, run: Run): Promise<string> {
  const folder = await ensureRunsFolder(graphFilePath);
  const path = `${folder}/${runFileName(run)}`;
  await writeTextFile(path, serializeRun(run));
  return path;
}

export async function listRunFiles(graphFilePath: string): Promise<Array<{ name: string; path: string }>> {
  const folder = runsFolderForGraph(graphFilePath);
  if (!(await exists(folder))) return [];
  const entries = await readDir(folder);
  return entries
    .filter((e) => e.name?.endsWith('.run.json'))
    .map((e) => ({ name: e.name!, path: `${folder}/${e.name!}` }))
    .sort((a, b) => b.name.localeCompare(a.name));   // newest first (timestamp prefix)
}

export async function readRun(path: string): Promise<Run> {
  return parseRun(await readTextFile(path));
}

export async function deleteRun(path: string): Promise<void> {
  await remove(path);
}
