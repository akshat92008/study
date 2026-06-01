import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPromptVersion } from '@/lib/ai/prompt-version';

describe('prompt version selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the specific surface env var first', () => {
    vi.stubEnv('DEFAULT_PROMPT_VERSION', 'default-v2');
    vi.stubEnv('MIND_PROMPT_VERSION', 'mind-v7');

    expect(getPromptVersion('mind')).toBe('mind-v7');
  });

  it('falls back to DEFAULT_PROMPT_VERSION', () => {
    vi.stubEnv('DEFAULT_PROMPT_VERSION', 'default-v2');

    expect(getPromptVersion('mentor')).toBe('default-v2');
  });

  it('falls back to stable v1', () => {
    expect(getPromptVersion('tutor')).toBe('v1');
  });
});
