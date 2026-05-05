// Write a file atomically: write to <path>.tmp, then rename to <path>.
// A crash between write and rename leaves the original intact. A crash
// after rename is the new content, durable.

import { writeFile, rename, remove, exists } from '@tauri-apps/plugin-fs';

export async function writeFileAtomic(path: string, bytes: Uint8Array): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, bytes);
  try {
    await rename(tmp, path);
  } catch (e) {
    // Best-effort cleanup; if even this fails we just leave the .tmp behind.
    if (await exists(tmp)) {
      try { await remove(tmp); } catch { /* swallow */ }
    }
    throw e;
  }
}
