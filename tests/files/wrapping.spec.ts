import { describe, it, expect } from 'vitest';
import { wrapFileBlock, concatFileBlocks } from '@/files/wrapping';

describe('wrapFileBlock', () => {
  it('wraps content with the XML-style file delimiter', () => {
    expect(wrapFileBlock('notes.txt', 'hello'))
      .toBe('<file name="notes.txt">\nhello\n</file>');
  });

  it('preserves multi-line content as-is', () => {
    expect(wrapFileBlock('a.txt', 'line1\nline2'))
      .toBe('<file name="a.txt">\nline1\nline2\n</file>');
  });

  it('escapes double quotes in the filename', () => {
    expect(wrapFileBlock('weird"name.txt', 'x'))
      .toBe('<file name="weird&quot;name.txt">\nx\n</file>');
  });

  it('handles empty content', () => {
    expect(wrapFileBlock('empty.txt', ''))
      .toBe('<file name="empty.txt">\n\n</file>');
  });
});

describe('concatFileBlocks', () => {
  it('joins multiple blocks with a blank line between', () => {
    expect(concatFileBlocks(['<file name="a">\n1\n</file>', '<file name="b">\n2\n</file>']))
      .toBe('<file name="a">\n1\n</file>\n\n<file name="b">\n2\n</file>');
  });

  it('returns empty string for an empty list', () => {
    expect(concatFileBlocks([])).toBe('');
  });

  it('returns the single block unchanged', () => {
    expect(concatFileBlocks(['<file name="a">\n1\n</file>']))
      .toBe('<file name="a">\n1\n</file>');
  });
});
