import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ChatAttachmentStrip from '@/components/chat/ChatAttachmentStrip.vue';
import { useChatStore } from '@/stores/chat';

beforeEach(() => setActivePinia(createPinia()));

describe('ChatAttachmentStrip', () => {
  it('renders nothing when there are no attachments', () => {
    const w = mount(ChatAttachmentStrip);
    expect(w.find('[data-testid="chat-attachment-strip"]').exists()).toBe(false);
  });

  it('renders a chip per attachment', () => {
    useChatStore().addAttachment({ kind: 'text', filename: 'a.txt', content: 'A', sizeBytes: 1 });
    useChatStore().addAttachment({ kind: 'text', filename: 'b.json', content: 'B', sizeBytes: 1024 });
    const w = mount(ChatAttachmentStrip);
    expect(w.text()).toContain('a.txt');
    expect(w.text()).toContain('b.json');
    expect(w.text()).toContain('1.0 KB');
  });

  it('removes an attachment when × is clicked', async () => {
    const c = useChatStore();
    c.addAttachment({ kind: 'text', filename: 'a.txt', content: 'A', sizeBytes: 1 });
    const w = mount(ChatAttachmentStrip);
    await w.find('button').trigger('click');
    expect(c.attachments).toEqual([]);
  });
});
