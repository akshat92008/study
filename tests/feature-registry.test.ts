import { isFeatureEnabled, getAppLaunchMode } from '../lib/feature-registry';

describe('Feature Registry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('enforces safe defaults in public_paid mode regardless of env overrides', () => {
    process.env.APP_LAUNCH_MODE = 'public_paid';
    // Even if env says these should be true, public_paid must override
    process.env.DEBUG_PAGES_ENABLED = 'true';
    process.env.WORKER_AI_ENABLED = 'true';

    expect(getAppLaunchMode()).toBe('public_paid');
    expect(isFeatureEnabled('debug_page')).toBe(false);
    expect(isFeatureEnabled('worker_ai')).toBe(false);
    expect(isFeatureEnabled('analytics_ui')).toBe(false);
    expect(isFeatureEnabled('atlas_ui')).toBe(false);
    expect(isFeatureEnabled('voice_chat')).toBe(false);
  });

  it('allows features in local mode', () => {
    process.env.APP_LAUNCH_MODE = 'local';
    process.env.DEBUG_PAGES_ENABLED = 'true';
    process.env.WORKER_AI_ENABLED = 'true';

    expect(isFeatureEnabled('debug_page')).toBe(true);
    expect(isFeatureEnabled('worker_ai')).toBe(true);
  });

  it('disables all features in maintenance mode', () => {
    process.env.APP_LAUNCH_MODE = 'maintenance';
    expect(isFeatureEnabled('chat')).toBe(false);
    expect(isFeatureEnabled('practice')).toBe(false);
  });
});
