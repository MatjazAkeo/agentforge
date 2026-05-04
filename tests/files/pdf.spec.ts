import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  GlobalWorkerOptions: { workerSrc: '' },
}));

import { extractPdfText } from '@/files/pdf';

beforeEach(() => {
  mockGetDocument.mockReset();
});

function fakeDoc(pages: string[][]) {
  return {
    promise: Promise.resolve({
      numPages: pages.length,
      getPage: (n: number) =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({ items: pages[n - 1].map((str) => ({ str })) }),
        }),
    }),
  };
}

describe('extractPdfText', () => {
  it('joins page text with double-newline between pages', async () => {
    mockGetDocument.mockReturnValue(fakeDoc([['hello', 'world'], ['second', 'page']]));
    const out = await extractPdfText(new ArrayBuffer(0));
    expect(out).toBe('hello world\n\nsecond page');
  });

  it('returns empty string for a doc with no extractable text', async () => {
    mockGetDocument.mockReturnValue(fakeDoc([[]]));
    const out = await extractPdfText(new ArrayBuffer(0));
    expect(out).toBe('');
  });

  it('passes the bytes argument through to pdfjs', async () => {
    mockGetDocument.mockReturnValue(fakeDoc([['x']]));
    const buf = new ArrayBuffer(8);
    await extractPdfText(buf);
    expect(mockGetDocument).toHaveBeenCalledWith({ data: buf });
  });
});
