import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChatStore } from '@/stores/chat';

beforeEach(() => setActivePinia(createPinia()));

describe('chat attachments', () => {
  it('starts empty', () => {
    const c = useChatStore();
    expect(c.attachments).toEqual([]);
  });

  it('adds an attachment', () => {
    const c = useChatStore();
    c.addAttachment({ kind: 'text', filename: 'a.txt', content: 'hello', sizeBytes: 5 });
    expect(c.attachments).toEqual([{ kind: 'text', filename: 'a.txt', content: 'hello', sizeBytes: 5 }]);
  });

  it('removes an attachment by index', () => {
    const c = useChatStore();
    c.addAttachment({ kind: 'text', filename: 'a.txt', content: 'A', sizeBytes: 1 });
    c.addAttachment({ kind: 'text', filename: 'b.txt', content: 'B', sizeBytes: 1 });
    c.removeAttachment(0);
    expect(c.attachments.map((a) => a.filename)).toEqual(['b.txt']);
  });

  it('clears all attachments', () => {
    const c = useChatStore();
    c.addAttachment({ kind: 'text', filename: 'a.txt', content: 'A', sizeBytes: 1 });
    c.clearAttachments();
    expect(c.attachments).toEqual([]);
  });

  it('composeUserMessage wraps each attachment in XML and appends after user text', () => {
    const c = useChatStore();
    c.addAttachment({ kind: 'text', filename: 'a.txt', content: 'AA', sizeBytes: 2 });
    c.addAttachment({ kind: 'text', filename: 'b.json', content: 'BB', sizeBytes: 2 });
    expect(c.composeUserMessage('Question?')).toBe(
      'Question?\n\n<file name="a.txt">\nAA\n</file>\n\n<file name="b.json">\nBB\n</file>',
    );
  });

  it('composeUserMessage returns the user text unchanged with no attachments', () => {
    const c = useChatStore();
    expect(c.composeUserMessage('hi')).toBe('hi');
  });
});
