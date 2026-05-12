import { describe, it, expect } from 'vitest';
import { colorForType } from './port-types';

describe('context wire type', () => {
  it('has the messages purple color', () => {
    expect(colorForType('context')).toBe('#b388ff');
  });
});
