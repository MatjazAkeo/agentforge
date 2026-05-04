// XML-style wrapping for file content fed into LLM messages. The format is the
// same on the graph side (file-input node) and the chat side (sidebar
// attachments) so models see consistent delimiters.

export function wrapFileBlock(filename: string, content: string): string {
  const safeName = filename.replace(/"/g, '&quot;');
  return `<file name="${safeName}">\n${content}\n</file>`;
}

export function concatFileBlocks(blocks: string[]): string {
  return blocks.join('\n\n');
}
