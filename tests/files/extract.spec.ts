import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtractPdf = vi.fn();
vi.mock('@/files/pdf', () => ({
  extractPdfText: (...args: unknown[]) => mockExtractPdf(...args),
}));

import { extractText, extensionOf } from '@/files/extract';

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

describe('extensionOf', () => {
  it('returns the last extension for normal filenames', () => {
    expect(extensionOf('notes.txt')).toBe('txt');
  });

  it('returns the last extension for multi-dot filenames', () => {
    expect(extensionOf('archive.tar.gz')).toBe('gz');
  });

  it('returns empty for files with no extension', () => {
    expect(extensionOf('Makefile')).toBe('');
  });

  it('returns empty for dotfiles (leading dot only)', () => {
    expect(extensionOf('.hidden')).toBe('');
    expect(extensionOf('.gitignore')).toBe('');
  });

  it('returns empty for an empty string', () => {
    expect(extensionOf('')).toBe('');
  });
});
