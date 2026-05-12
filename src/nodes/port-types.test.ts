import { describe, it, expect } from 'vitest';
import { colorForType } from './port-types';

describe('images wire type', () => {
  it('has a distinct color', () => {
    expect(colorForType('images')).toBe('#7ad48c');
  });

});

describe('context wire type', () => {
  it('has the messages purple color', () => {
    expect(colorForType('context')).toBe('#b388ff');
  });
});
