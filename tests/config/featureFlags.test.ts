import { afterEach, describe, expect, it, vi } from 'vitest';
import { featureFlags, isEnabled } from '@/lib/config/flags';

describe('feature flags', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the provided default when a flag is missing', () => {
    vi.stubEnv('ENABLE_RAG_INGESTION', '');
    expect(isEnabled('ENABLE_RAG_INGESTION', true)).toBe(true);
    expect(isEnabled('ENABLE_RAG_INGESTION', false)).toBe(false);
  });

  it.each(['true', '1', 'yes', 'on'])('parses %s as enabled', (value) => {
    vi.stubEnv('ENABLE_AI_ESCALATION', value);
    expect(isEnabled('ENABLE_AI_ESCALATION')).toBe(true);
  });

  it.each(['false', '0', 'no', 'off'])('does not parse %s as enabled', (value) => {
    vi.stubEnv('ENABLE_AI_ESCALATION', value);
    expect(isEnabled('ENABLE_AI_ESCALATION')).toBe(false);
  });

  it('uses cheap agentic defaults', () => {
    vi.stubEnv('ENABLE_VISION_UPLOADS', '');
    vi.stubEnv('ENABLE_RAG_INGESTION', '');
    vi.stubEnv('ENABLE_AUTOPSY_PROCESSING', '');
    vi.stubEnv('ENABLE_AGENT_ACTIONS', '');
    vi.stubEnv('ENABLE_AI_ESCALATION', '');

    expect(featureFlags.visionUploads()).toBe(false);
    expect(featureFlags.ragIngestion()).toBe(true);
    expect(featureFlags.autopsyProcessing()).toBe(false);
    expect(featureFlags.agentActions()).toBe(false);
    expect(featureFlags.aiEscalation()).toBe(true);
  });
});
