// src/persistence/assets-dir.ts
//
// Side-car directory bridge over @tauri-apps/plugin-fs. The directory mirrors
// the .runs/ convention: <graph-name>.assets/ next to the graph file. Files
// are copied (not moved); collisions get a -2/-3 suffix; never overwrite.

import { exists, mkdir, readFile, writeFile, remove } from '@tauri-apps/plugin-fs';

const GRAPH_JSON_SUFFIX = '.graph.json';

export function assetsDirFor(graphPath: string): string {
  if (graphPath.endsWith(GRAPH_JSON_SUFFIX)) {
    return graphPath.slice(0, -GRAPH_JSON_SUFFIX.length) + '.assets';
  }
  // Fallback for non-conforming names: replace the last extension.
  const slashIdx = Math.max(graphPath.lastIndexOf('/'), graphPath.lastIndexOf('\\'));
  const dot = graphPath.lastIndexOf('.');
  if (dot === -1 || dot < slashIdx) return graphPath + '.assets';
  return graphPath.slice(0, dot) + '.assets';
}

export async function ensureAssetsDir(graphPath: string): Promise<string> {
  const dir = assetsDirFor(graphPath);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

function basenameOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return idx === -1 ? path : path.slice(idx + 1);
}

function splitExt(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

export async function copyToAssets(graphPath: string, sourceAbsPath: string): Promise<string> {
  const dir = await ensureAssetsDir(graphPath);
  const original = basenameOf(sourceAbsPath);
  const { stem, ext } = splitExt(original);

  let candidate = original;
  let n = 2;
  while (await exists(`${dir}/${candidate}`)) {
    candidate = `${stem}-${n}${ext}`;
    n++;
  }

  const bytes = await readFile(sourceAbsPath);
  await writeFile(`${dir}/${candidate}`, bytes);
  return candidate;
}

const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function writeOptimizedAsset(
  graphPath: string,
  sourceBasename: string,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  const dir = await ensureAssetsDir(graphPath);
  const ext = EXT_FOR_MIME[mime] ?? 'bin';
  const stem = sourceBasename.replace(/\.[^.]+$/, '');
  let candidate = `${stem}.${ext}`;
  let n = 2;
  while (await exists(`${dir}/${candidate}`)) {
    candidate = `${stem}-${n}.${ext}`;
    n++;
  }
  await writeFile(`${dir}/${candidate}`, bytes);
  return candidate;
}

export async function readAssetBytes(graphPath: string, filename: string): Promise<ArrayBuffer> {
  const u8 = await readFile(`${assetsDirFor(graphPath)}/${filename}`);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

export async function assetExists(graphPath: string, filename: string): Promise<boolean> {
  return await exists(`${assetsDirFor(graphPath)}/${filename}`);
}

export async function removeAsset(graphPath: string, filename: string): Promise<void> {
  await remove(`${assetsDirFor(graphPath)}/${filename}`);
}
