// Lazy import of pdfjs-dist — the dependency is only loaded the first time a
// PDF is actually extracted. Keeps the cold-start bundle lean for graphs that
// never use PDFs.

export async function extractPdfText(bytes: ArrayBuffer): Promise<string> {
  const { getDocument } = await import('pdfjs-dist');
  const doc = await getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: { str: string }) => it.str).join(' '));
  }
  return pages.join('\n\n');
}
