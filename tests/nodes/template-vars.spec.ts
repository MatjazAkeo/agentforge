import { describe, it, expect } from 'vitest';
import { extractPlaceholders, renderTemplate } from '@/nodes/_internals/template-vars';

describe('extractPlaceholders', () => {
  it('returns [] for a template with no placeholders', () => {
    expect(extractPlaceholders('plain text')).toEqual([]);
  });

  it('finds a single placeholder', () => {
    expect(extractPlaceholders('Hello {{name}}!')).toEqual(['name']);
  });

  it('finds multiple distinct placeholders preserving first-seen order', () => {
    expect(extractPlaceholders('{{a}} then {{b}} then {{a}}')).toEqual(['a', 'b']);
  });

  it('trims whitespace inside braces', () => {
    expect(extractPlaceholders('Hello {{  name  }}')).toEqual(['name']);
  });

  it('ignores malformed braces', () => {
    expect(extractPlaceholders('{name} {{ }} {{1bad}} {{good}}')).toEqual(['good']);
  });
});

describe('renderTemplate', () => {
  it('substitutes values for placeholders', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'world' })).toBe('Hello world!');
  });

  it('substitutes multiple placeholders', () => {
    expect(renderTemplate('{{greet}}, {{name}}', { greet: 'Hi', name: 'Ada' }))
      .toBe('Hi, Ada');
  });

  it('coerces non-string values to JSON strings', () => {
    expect(renderTemplate('total = {{n}}', { n: 42 })).toBe('total = 42');
    expect(renderTemplate('list = {{x}}', { x: [1, 2, 3] })).toBe('list = [1,2,3]');
  });

  it('replaces missing placeholders with an empty string', () => {
    expect(renderTemplate('Hi {{missing}}!', {})).toBe('Hi !');
  });

  it('extracts text from Context[] inputs via extractText', () => {
    expect(renderTemplate('Hi {{name}}!', { name: [{ role: 'user', content: 'Ada' }] }))
      .toBe('Hi Ada!');
  });

  it('extracts the last message text from a multi-message context', () => {
    expect(renderTemplate('Reply: {{r}}', {
      r: [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'final answer' },
      ],
    })).toBe('Reply: final answer');
  });

  it('JSON-stringifies non-context arrays (e.g., Tool Runner results)', () => {
    // Arrays whose first element is not role-bearing are NOT contexts.
    expect(renderTemplate('list = {{x}}', { x: [1, 2, 3] })).toBe('list = [1,2,3]');
  });
});
