import { describe, it, expect } from 'vitest';
import { colorForType, getSourcePortType, getTargetPortType } from './port-types';

describe('images wire type', () => {
  it('has a distinct color', () => {
    expect(colorForType('images')).toBe('#7ad48c');
  });

  it('is the source port type for file-input.images', () => {
    const node = { id: 'fi', type: 'file-input' as const, position: { x: 0, y: 0 }, config: {} };
    expect(getSourcePortType(node, 'images')).toBe('images');
  });

  it('is the source port type for chat-input.images', () => {
    const node = { id: 'ci', type: 'chat-input' as const, position: { x: 0, y: 0 }, config: {} };
    expect(getSourcePortType(node, 'images')).toBe('images');
  });

  it('is the target port type for llm-call.images', () => {
    const node = { id: 'lc', type: 'llm-call' as const, position: { x: 0, y: 0 }, config: {} };
    expect(getTargetPortType(node, 'images')).toBe('images');
  });
});
