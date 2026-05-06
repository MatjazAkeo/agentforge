import { describe, it, expect } from 'vitest';
import { isBetaVersion } from '@/stores/update';

describe('isBetaVersion', () => {
  it('matches plain -beta', () => {
    expect(isBetaVersion('0.2.0-beta')).toBe(true);
  });

  it('matches numbered beta', () => {
    expect(isBetaVersion('0.2.0-beta1')).toBe(true);
    expect(isBetaVersion('0.2.0-beta.3')).toBe(true);
  });

  it('matches alpha, rc, dev, canary identifiers', () => {
    expect(isBetaVersion('0.2.0-alpha')).toBe(true);
    expect(isBetaVersion('0.2.0-alpha.2')).toBe(true);
    expect(isBetaVersion('1.0.0-rc.1')).toBe(true);
    expect(isBetaVersion('1.0.0-dev')).toBe(true);
    expect(isBetaVersion('1.0.0-dev.5')).toBe(true);
    expect(isBetaVersion('1.0.0-canary')).toBe(true);
    expect(isBetaVersion('1.0.0-canary.20260506')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isBetaVersion('0.2.0-BETA')).toBe(true);
    expect(isBetaVersion('1.0.0-RC.1')).toBe(true);
    expect(isBetaVersion('1.0.0-DEV')).toBe(true);
  });

  it('rejects stable versions', () => {
    expect(isBetaVersion('0.1.4')).toBe(false);
    expect(isBetaVersion('1.2.3')).toBe(false);
    expect(isBetaVersion('0.0.1')).toBe(false);
  });

  it('rejects unrelated pre-release identifiers', () => {
    expect(isBetaVersion('1.0.0-nightly')).toBe(false);
    expect(isBetaVersion('1.0.0-snapshot')).toBe(false);
  });

  it('rejects strings that mention beta but not as a pre-release suffix', () => {
    expect(isBetaVersion('beta-1.0.0')).toBe(false);
  });
});
