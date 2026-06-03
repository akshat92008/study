import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HermesDisabledError, HermesAgentError, HermesSchemaError, isHermesError } from '@/lib/hermes/hermes-errors';

// Mock budgetedGenerateJSON
vi.mock('@/lib/ai/budgeted', () => ({
  budgetedGenerateJSON: vi.fn(),
}));

import { budgetedGenerateJSON } from '@/lib/ai/budgeted';

describe('Hermes Error Classes', () => {
  it('HermesDisabledError has correct code', () => {
    const err = new HermesDisabledError();
    expect(err.code).toBe('HERMES_DISABLED');
    expect(err).toBeInstanceOf(Error);
  });

  it('HermesAgentError wraps cause', () => {
    const cause = new Error('provider failed');
    const err = new HermesAgentError('hermes_mistake', cause);
    expect(err.code).toBe('HERMES_AGENT_ERROR');
    expect(err.agentName).toBe('hermes_mistake');
    expect(err.message).toContain('provider failed');
  });

  it('HermesSchemaError preserves issues', () => {
    const issues = [{ path: ['cards'], message: 'Required' }];
    const err = new HermesSchemaError('hermes_mistake', issues);
    expect(err.code).toBe('HERMES_SCHEMA_ERROR');
    expect(err.issues).toEqual(issues);
  });

  it('isHermesError identifies all Hermes errors', () => {
    expect(isHermesError(new HermesDisabledError())).toBe(true);
    expect(isHermesError(new HermesAgentError('x', new Error()))).toBe(true);
    expect(isHermesError(new HermesSchemaError('x', []))).toBe(true);
    expect(isHermesError(new Error('normal error'))).toBe(false);
    expect(isHermesError(null)).toBe(false);
    expect(isHermesError('string error')).toBe(false);
  });
});

describe('runHermesJSON — Hermes disabled', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.HERMES_ENABLED = 'false';
  });

  afterEach(() => {
    delete process.env.HERMES_ENABLED;
  });

  it('throws HermesDisabledError when HERMES_ENABLED=false', async () => {
    const { runHermesJSON } = await import('@/lib/hermes/hermes-client');
    const { HermesDisabledError: DisabledErr } = await import('@/lib/hermes/hermes-errors');
    const { z } = await import('zod');

    await expect(
      runHermesJSON({
        userId: 'user-123',
        feature: 'hermes_mistake',
        route: '/test',
        systemPrompt: 'system',
        userPrompt: 'user',
        schema: z.object({ test: z.string() }),
        modelTier: 'fast',
      })
    ).rejects.toThrow(DisabledErr);
  });
});

describe('runHermesJSON — Hermes enabled', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.HERMES_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.HERMES_ENABLED;
  });

  it('validates output against schema and returns typed data', async () => {
    // Re-mock after resetModules
    const budgetedMod = await import('@/lib/ai/budgeted');
    vi.spyOn(budgetedMod, 'budgetedGenerateJSON').mockResolvedValue({ name: 'test concept', value: 42 } as any);

    const { runHermesJSON } = await import('@/lib/hermes/hermes-client');
    const { z } = await import('zod');

    const result = await runHermesJSON({
      userId: 'user-123',
      feature: 'hermes_mistake',
      route: '/test',
      systemPrompt: 'system',
      userPrompt: 'user',
      schema: z.object({ name: z.string(), value: z.number() }),
      modelTier: 'fast',
    });

    expect(result).toEqual({ name: 'test concept', value: 42 });
  });

  it('throws HermesSchemaError when output fails Zod validation', async () => {
    const budgetedMod = await import('@/lib/ai/budgeted');
    vi.spyOn(budgetedMod, 'budgetedGenerateJSON').mockResolvedValue({ wrong: 'structure' } as any);

    const { runHermesJSON } = await import('@/lib/hermes/hermes-client');
    const { HermesSchemaError: SchemaErr } = await import('@/lib/hermes/hermes-errors');
    const { z } = await import('zod');

    await expect(
      runHermesJSON({
        userId: 'user-123',
        feature: 'hermes_mistake',
        route: '/test',
        systemPrompt: 'system',
        userPrompt: 'user',
        schema: z.object({ required_field: z.string() }),
        modelTier: 'fast',
      })
    ).rejects.toThrow(SchemaErr);
  });

  it('wraps provider error in HermesAgentError', async () => {
    const budgetedMod = await import('@/lib/ai/budgeted');
    vi.spyOn(budgetedMod, 'budgetedGenerateJSON').mockRejectedValue(new Error('provider 503'));

    const { runHermesJSON } = await import('@/lib/hermes/hermes-client');
    const { HermesAgentError: AgentErr } = await import('@/lib/hermes/hermes-errors');
    const { z } = await import('zod');

    await expect(
      runHermesJSON({
        userId: 'user-123',
        feature: 'hermes_mistake',
        route: '/test',
        systemPrompt: 'system',
        userPrompt: 'user',
        schema: z.object({ test: z.string() }),
        modelTier: 'fast',
      })
    ).rejects.toThrow(AgentErr);
  });
});
