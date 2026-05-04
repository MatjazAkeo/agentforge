// Dispatches text extraction by file extension. UTF-8 decode for txt/json,
// pdfjs for pdf. Unknown extensions throw — the inspector should reject those
// at attach time, but defense-in-depth here.

import { extractPdfText } from './pdf';

export async function extractText(bytes: ArrayBuffer, extension: string): Promise<string> {
  const ext = extension.toLowerCase();
  switch (ext) {
    case 'txt':
    case 'json':
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    case 'pdf':
      return extractPdfText(bytes);
    default:
      throw new Error(`unsupported file extension: ${ext}`);
  }
}

/** Returns the extension without the dot, or empty string if none.
 *  Treats dotfiles (e.g. `.hidden`, `.gitignore`) as having no extension,
 *  matching Node's `path.extname` semantics. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot <= 0 ? '' : filename.slice(dot + 1);
}
