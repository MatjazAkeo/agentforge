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
    // pdfjs `items` is (TextItem | TextMarkedContent)[]. Only TextItem carries
    // `str`; TextMarkedContent is layout marker metadata we skip.
    const texts: string[] = [];
    for (const it of content.items) {
      const maybe = it as { str?: unknown };
      if (typeof maybe.str === 'string') texts.push(maybe.str);
    }
    pages.push(texts.join(' '));
  }
  return pages.join('\n\n');
}
