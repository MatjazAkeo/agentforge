import { describe, it, expect } from 'vitest';
import { buildMessagesForTest } from '@/nodes/llm-call';
import type { ImageRef } from '@/domain/images';
import type { ChatMessage } from '@/openrouter/types';

const cfg = {
  model: 'm',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: null,
  responseFormat: null,
};

describe('buildMessages — multimodal one-shot mode', () => {
  it('appends image_url parts to a fresh user message when text + resolvedImages are present', () => {
    const result = buildMessagesForTest(cfg, { text: 'describe this' }, ['data:image/jpeg;base64,xxx']);
    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'describe this' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,xxx' } },
        ],
      },
    ]);
  });

  it('emits an image-only user message when text is empty', () => {
    const result = buildMessagesForTest(cfg, {}, ['data:image/png;base64,yyy']);
    expect(result[0].content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,yyy' } },
    ]);
  });

  it('falls back to string content when no images', () => {
    const result = buildMessagesForTest(cfg, { text: 'plain' }, []);
    expect(result).toEqual([{ role: 'user', content: 'plain' }]);
  });

  it('prepends system prompt when configured (one-shot mode)', () => {
    const result = buildMessagesForTest({ ...cfg, systemPrompt: 'be brief' }, { text: 'hi' }, []);
    expect(result[0]).toEqual({ role: 'system', content: 'be brief' });
  });
});

describe('buildMessages — precedence rule (messages wins)', () => {
  it('ignores text + resolvedImages when messages is wired', () => {
    const history: ChatMessage[] = [{ role: 'user', content: 'prior' }];
    const images: ImageRef[] = [{ kind: 'inline', dataUrl: 'data:image/jpeg;base64,xxx', mime: 'image/jpeg' }];
    const result = buildMessagesForTest(
      cfg,
      { messages: history, text: 'ignored', images },
      ['data:image/jpeg;base64,xxx'],
    );
    expect(result).toEqual(history);
  });
});
