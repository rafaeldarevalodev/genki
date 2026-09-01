import { describe, expect, it } from 'vitest';
import { isModelConnectionsFeatureEnabled } from './providers';

describe('model connections feature flag', () => {
  it('is disabled when the rollback flag is absent or false', () => {
    expect(isModelConnectionsFeatureEnabled()).toBe(false);
    expect(isModelConnectionsFeatureEnabled('false')).toBe(false);
  });

  it('keeps model connections disabled until the browser execution slice is migrated', () => {
    expect(isModelConnectionsFeatureEnabled('true')).toBe(false);
  });

  it('enables model connections only when the rollback flag is true and browser execution is ready', () => {
    expect(isModelConnectionsFeatureEnabled('true', true)).toBe(true);
  });
});
