// lib/hermes/hermes-errors.ts
// All Hermes-specific error classes.
// These must never leak raw messages to the user.

export class HermesDisabledError extends Error {
  readonly code = 'HERMES_DISABLED';
  constructor() {
    super('Hermes worker is disabled. Check HERMES_ENABLED environment variable.');
    this.name = 'HermesDisabledError';
  }
}

export class HermesAgentError extends Error {
  readonly code = 'HERMES_AGENT_ERROR';
  constructor(
    readonly agentName: string,
    readonly cause: unknown,
  ) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause);
    super(`Hermes agent "${agentName}" failed: ${causeMsg}`);
    this.name = 'HermesAgentError';
  }
}

export class HermesSchemaError extends Error {
  readonly code = 'HERMES_SCHEMA_ERROR';
  constructor(
    readonly agentName: string,
    readonly issues: unknown,
  ) {
    super(`Hermes agent "${agentName}" returned invalid JSON structure.`);
    this.name = 'HermesSchemaError';
  }
}

export class HermesTimeoutError extends Error {
  readonly code = 'HERMES_TIMEOUT';
  constructor(readonly agentName: string, readonly timeoutMs: number) {
    super(`Hermes agent "${agentName}" timed out after ${timeoutMs}ms.`);
    this.name = 'HermesTimeoutError';
  }
}

export class HermesBudgetError extends Error {
  readonly code = 'HERMES_BUDGET_EXCEEDED';
  constructor() {
    super('Hermes agent skipped — AI daily budget exceeded.');
    this.name = 'HermesBudgetError';
  }
}

export function isHermesError(err: unknown): err is HermesDisabledError | HermesAgentError | HermesSchemaError | HermesTimeoutError | HermesBudgetError {
  return (
    err instanceof HermesDisabledError ||
    err instanceof HermesAgentError ||
    err instanceof HermesSchemaError ||
    err instanceof HermesTimeoutError ||
    err instanceof HermesBudgetError
  );
}
