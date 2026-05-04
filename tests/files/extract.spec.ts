import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtractPdf = vi.fn();
vi.mock('@/files/pdf', () => ({
  extractPdfText: (...args: unknown[]) => mockExtractPdf(...args),
}));

import { extractText } from '@/files/extract';

beforeEach(() => mockExtractPdf.mockReset());

function utf8(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer;
}

describe('extractText', () => {
  it('decodes a txt file as UTF-8', async () => {
    const out = await extractText(utf8('hello'), 'txt');
    expect(out).toBe('hello');
  });

  it('decodes a json file as UTF-8 (no parsing)', async () => {
    const out = await extractText(utf8('{"a":1}'), 'json');
    expect(out).toBe('{"a":1}');
  });

  it('routes pdf to extractPdfText', async () => {
    mockExtractPdf.mockResolvedValue('extracted');
    const out = await extractText(new ArrayBuffer(8), 'pdf');
    expect(out).toBe('extracted');
    expect(mockExtractPdf).toHaveBeenCalled();
  });

  it('throws on an unknown extension', async () => {
    await expect(extractText(utf8(''), 'docx')).rejects.toThrow(/unsupported/);
  });

  it('treats extension case-insensitively', async () => {
    const out = await extractText(utf8('hi'), 'TXT');
    expect(out).toBe('hi');
  });
});
