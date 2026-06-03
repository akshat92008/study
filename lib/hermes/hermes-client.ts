// lib/hermes/hermes-client.ts
// The core Hermes execution engine.
// Wraps budgetedGenerateJSON with:
//   - Hermes config gating (HERMES_ENABLED check)
//   - Timeout enforcement
//   - Zod schema validation
//   - Safe error handling (no raw provider errors leak)
//
// IMPORTANT: Hermes is internal-only. Never expose this interface to users.

import { budgetedGenerateJSON } from '@/lib/ai/budgeted';
import type { HermesRunInput } from './hermes-types';
import {
  HermesDisabledError,
  HermesAgentError,
  HermesSchemaError,
  HermesTimeoutError,
} from './hermes-errors';
import { isHermesEnabled, getHermesConfig } from './hermes-config';
import { hermesLogger } from './hermes-logger';
import { resolveModelTier, hermesFeatureToBudgetFeature } from './hermes-budget';

/**
 * Execute a Hermes agent call with full safety guardrails.
 *
 * - Checks HERMES_ENABLED before any AI call
 * - Enforces timeout via AbortSignal (wraps the budget call)
 * - Validates output with the provided Zod schema
 * - Returns typed result T on success
 * - Throws HermesDisabledError | HermesAgentError | HermesSchemaError | HermesTimeoutError
 *
 * Callers MUST handle all Hermes errors with a safe fallback.
 * Never return raw Hermes errors to the user.
 */
export async function runHermesJSON<T>(input: HermesRunInput<T>): Promise<T> {
  if (!isHermesEnabled()) {
    throw new HermesDisabledError();
  }

  const config = getHermesConfig();
  const model = resolveModelTier(input.modelTier);
  const budgetFeature = hermesFeatureToBudgetFeature(input.feature);
  const timeoutMs = input.timeoutMs ?? config.timeoutMs;

  hermesLogger.info(`Agent starting: ${input.feature}`, {
    userId: input.userId,
    feature: input.feature,
    route: input.route,
    modelTier: input.modelTier,
    model,
  });

  const start = Date.now();

  try {
    // Wrap in a timeout race
    const resultPromise = budgetedGenerateJSON<unknown>({
      userId: input.userId,
      feature: budgetFeature,
      route: input.route,
      model,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      maxOutputTokens: config.maxOutputTokens,
      metadata: {
        hermesFeature: input.feature,
        modelTier: input.modelTier,
        ...input.metadata,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new HermesTimeoutError(input.feature, timeoutMs)),
        timeoutMs
      )
    );

    const raw = await Promise.race([resultPromise, timeoutPromise]);

    // Validate with Zod schema
    const parseResult = input.schema.safeParse(raw);
    if (!parseResult.success) {
      hermesLogger.warn(`Schema validation failed: ${input.feature}`, {
        issues: parseResult.error.issues.slice(0, 5),
        userId: input.userId,
      });
      throw new HermesSchemaError(input.feature, parseResult.error.issues);
    }

    const durationMs = Date.now() - start;
    hermesLogger.info(`Agent completed: ${input.feature}`, {
      userId: input.userId,
      durationMs,
    });

    return parseResult.data;

  } catch (err) {
    // Re-throw known Hermes errors
    if (
      err instanceof HermesDisabledError ||
      err instanceof HermesSchemaError ||
      err instanceof HermesTimeoutError
    ) {
      throw err;
    }

    // Wrap unknown errors (provider failures, budget errors, etc.)
    hermesLogger.error(`Agent failed: ${input.feature}`, err, {
      userId: input.userId,
      durationMs: Date.now() - start,
    });
    throw new HermesAgentError(input.feature, err);
  }
}
