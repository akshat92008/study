/**
 * Agent Runtime Error Types
 * All errors are typed with codes for safe handling in the runtime.
 */

export const ErrorCodes = {
  // Tool errors
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  TOOL_VALIDATION_FAILED: 'TOOL_VALIDATION_FAILED',
  TOOL_GUARDRAIL_BLOCKED: 'TOOL_GUARDRAIL_BLOCKED',
  TOOL_UNAUTHORIZED: 'TOOL_UNAUTHORIZED',
  TOOL_CHANNEL_NOT_ALLOWED: 'TOOL_CHANNEL_NOT_ALLOWED',

  // Budget errors
  BUDGET_ITERATIONS_EXHAUSTED: 'BUDGET_ITERATIONS_EXHAUSTED',
  BUDGET_TOOL_CALLS_EXHAUSTED: 'BUDGET_TOOL_CALLS_EXHAUSTED',
  BUDGET_SAME_TOOL_LIMIT: 'BUDGET_SAME_TOOL_LIMIT',

  // Verification errors
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  VERIFICATION_MISSING: 'VERIFICATION_MISSING',

  // Model errors
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MODEL_PLAN_INVALID: 'MODEL_PLAN_INVALID',
  MODEL_PLAN_REPAIR_FAILED: 'MODEL_PLAN_REPAIR_FAILED',

  // Runtime errors
  RUNTIME_INIT_FAILED: 'RUNTIME_INIT_FAILED',
  RUNTIME_RUN_FAILED: 'RUNTIME_RUN_FAILED',
  RUNTIME_SETUP_FAILED: 'RUNTIME_SETUP_FAILED',

  // Idempotency errors
  IDEMPOTENCY_DUPLICATE: 'IDEMPOTENCY_DUPLICATE',
  IDEMPOTENCY_BLOCKED: 'IDEMPOTENCY_BLOCKED',

  // Ownership errors
  ENTITY_NOT_OWNED: 'ENTITY_NOT_OWNED',
  CROSS_USER_ACCESS: 'CROSS_USER_ACCESS',

  // Skill errors
  SKILL_CREATION_FAILED: 'SKILL_CREATION_FAILED',
  SKILL_RETRIEVAL_FAILED: 'SKILL_RETRIEVAL_FAILED',

  // Input/validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  CHANNEL_NOT_SUPPORTED: 'CHANNEL_NOT_SUPPORTED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export class AgentRuntimeError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(message: string, code: ErrorCode, details: Record<string, unknown> = {}, retryable = false) {
    super(message);
    this.name = 'AgentRuntimeError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export class ToolExecutionError extends AgentRuntimeError {
  readonly toolName: string;
  readonly input: Record<string, unknown>;

  constructor(toolName: string, message: string, input: Record<string, unknown> = {}, details: Record<string, unknown> = {}) {
    super(message, ErrorCodes.TOOL_EXECUTION_FAILED, { toolName, input, ...details }, false);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.input = input;
  }
}

export class VerificationError extends AgentRuntimeError {
  readonly entityType: string;
  readonly entityId: string;
  readonly expected: Record<string, unknown>;
  readonly actual: Record<string, unknown>;

  constructor(message: string, entityType: string, entityId: string, expected: Record<string, unknown>, actual: Record<string, unknown>) {
    super(message, ErrorCodes.VERIFICATION_FAILED, { entityType, entityId, expected, actual }, false);
    this.name = 'VerificationError';
    this.entityType = entityType;
    this.entityId = entityId;
    this.expected = expected;
    this.actual = actual;
  }
}

export class GuardrailBlockedError extends AgentRuntimeError {
  readonly guardrailName: string;
  readonly toolName: string;
  readonly reason: string;

  constructor(guardrailName: string, toolName: string, reason: string) {
    super(
      `Guardrail '${guardrailName}' blocked tool '${toolName}': ${reason}`,
      ErrorCodes.TOOL_GUARDRAIL_BLOCKED,
      { guardrailName, toolName, reason },
      false
    );
    this.name = 'GuardrailBlockedError';
    this.guardrailName = guardrailName;
    this.toolName = toolName;
    this.reason = reason;
  }
}

export class BudgetExhaustedError extends AgentRuntimeError {
  readonly budgetType: 'iterations' | 'tool_calls' | 'per_tool';
  readonly budgetName: string;
  readonly used: number;
  readonly max: number;

  constructor(budgetType: 'iterations' | 'tool_calls' | 'per_tool', budgetName: string, used: number, max: number) {
    const message = `Budget exhausted: ${budgetType} (${used}/${max}) for '${budgetName}'`;
    const code = budgetType === 'iterations'
      ? ErrorCodes.BUDGET_ITERATIONS_EXHAUSTED
      : budgetType === 'tool_calls'
        ? ErrorCodes.BUDGET_TOOL_CALLS_EXHAUSTED
        : ErrorCodes.BUDGET_SAME_TOOL_LIMIT;
    super(message, code, { budgetType, budgetName, used, max }, false);
    this.name = 'BudgetExhaustedError';
    this.budgetType = budgetType;
    this.budgetName = budgetName;
    this.used = used;
    this.max = max;
  }
}

export class ModelPlanInvalidError extends AgentRuntimeError {
  readonly planErrors: string[];
  readonly rawPlan: unknown;

  constructor(message: string, planErrors: string[], rawPlan: unknown) {
    super(message, ErrorCodes.MODEL_PLAN_INVALID, { planErrors, rawPlan }, false);
    this.name = 'ModelPlanInvalidError';
    this.planErrors = planErrors;
    this.rawPlan = rawPlan;
  }
}

export class IdempotencyError extends AgentRuntimeError {
  readonly idempotencyKey: string;
  readonly existingRunId: string;
  readonly existingStatus: string;

  constructor(idempotencyKey: string, existingRunId: string, existingStatus: string) {
    super(
      `Idempotency key already used with run ${existingRunId} (status: ${existingStatus})`,
      ErrorCodes.IDEMPOTENCY_DUPLICATE,
      { idempotencyKey, existingRunId, existingStatus },
      false
    );
    this.name = 'IdempotencyError';
    this.idempotencyKey = idempotencyKey;
    this.existingRunId = existingRunId;
    this.existingStatus = existingStatus;
  }
}

export class EntityOwnershipError extends AgentRuntimeError {
  readonly entityType: string;
  readonly entityId: string;
  readonly userId: string;

  constructor(entityType: string, entityId: string, userId: string) {
    super(
      `User ${userId} does not own ${entityType} ${entityId}`,
      ErrorCodes.ENTITY_NOT_OWNED,
      { entityType, entityId, userId },
      false
    );
    this.name = 'EntityOwnershipError';
    this.entityType = entityType;
    this.entityId = entityId;
    this.userId = userId;
  }
}

export class ChannelNotSupportedError extends AgentRuntimeError {
  readonly channel: string;

  constructor(channel: string) {
    super(`Channel '${channel}' is not supported by the agent runtime`, ErrorCodes.CHANNEL_NOT_SUPPORTED, { channel }, false);
    this.name = 'ChannelNotSupportedError';
    this.channel = channel;
  }
}