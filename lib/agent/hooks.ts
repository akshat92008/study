/**
 * Lifecycle hooks for the agent runtime.
 * Allows extending behavior at specific points in the agent loop.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export type AgentStepType =
  | 'observe'
  | 'plan'
  | 'tool_call'
  | 'tool_result'
  | 'verify'
  | 'respond'
  | 'background_review'
  | 'skill_match'
  | 'error';

export type HookName =
  | 'beforeAgentRun'
  | 'afterAgentRun'
  | 'beforeModelPlan'
  | 'afterModelPlan'
  | 'beforeToolCall'
  | 'afterToolCall'
  | 'afterToolFailure'
  | 'beforeVerification'
  | 'afterVerification'
  | 'beforeResponse'
  | 'afterResponse'
  | 'beforeMemoryWrite'
  | 'afterMemoryWrite'
  | 'onGuardrailBlocked'
  | 'onBackgroundReview'
  | 'onSkillMatched'
  | 'onSkillCreated';

export interface HookContext {
  runId: string;
  userId: string;
  channel: string;
  stepType?: AgentStepType;
  toolName?: string;
  toolResult?: Record<string, unknown>;
  error?: Error;
  warnings?: string[];
  [key: string]: unknown;
}

export type HookFn = (context: HookContext) => Promise<void>;

export interface AgentHooks {
  beforeAgentRun?: HookFn[];
  afterAgentRun?: HookFn[];
  beforeModelPlan?: HookFn[];
  afterModelPlan?: HookFn[];
  beforeToolCall?: HookFn[];
  afterToolCall?: HookFn[];
  afterToolFailure?: HookFn[];
  beforeVerification?: HookFn[];
  afterVerification?: HookFn[];
  beforeResponse?: HookFn[];
  afterResponse?: HookFn[];
  beforeMemoryWrite?: HookFn[];
  afterMemoryWrite?: HookFn[];
  onGuardrailBlocked?: HookFn[];
  onBackgroundReview?: HookFn[];
  onSkillMatched?: HookFn[];
  onSkillCreated?: HookFn[];
}

/**
 * Default no-op hooks that log execution.
 * In production these can be replaced with actual webhook/analytics calls.
 */
function defaultHook(name: HookName): HookFn {
  return async (context: HookContext) => {
    logger.info(`[agent-hook:${name}]`, {
      runId: context.runId,
      userId: context.userId,
      channel: context.channel,
      stepType: context.stepType,
      toolName: context.toolName,
    });
  };
}

export const defaultHooks: AgentHooks = {
  beforeAgentRun: [],
  afterAgentRun: [],
  beforeModelPlan: [],
  afterModelPlan: [],
  beforeToolCall: [],
  afterToolCall: [],
  afterToolFailure: [],
  beforeVerification: [],
  afterVerification: [],
  beforeResponse: [],
  afterResponse: [],
  beforeMemoryWrite: [],
  afterMemoryWrite: [],
  onGuardrailBlocked: [],
  onBackgroundReview: [],
  onSkillMatched: [],
  onSkillCreated: [],
};

/**
 * HooksManager - orchestrates hook execution with error isolation.
 * Hooks never crash the core runtime unless explicitly configured to do so.
 */
export class HooksManager {
  constructor(
    private hooks: AgentHooks = defaultHooks,
    private throwOnHookError: boolean = false
  ) {}

  /**
   * Execute all hooks for a given name, with error isolation.
   * Returns array of warnings if any hooks failed.
   */
  async execute(name: HookName, context: HookContext): Promise<string[]> {
    const warnings: string[] = [];
    const namedHooks = this.hooks[name];
    if (!namedHooks || namedHooks.length === 0) return warnings;

    for (const hook of namedHooks) {
      try {
        await hook(context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const warning = `[hook:${name}] failed: ${message}`;
        warnings.push(warning);
        logger.warn(`[hook:${name}] failed`, { runId: context.runId, error: message });
        if (this.throwOnHookError) throw error;
      }
    }

    return warnings;
  }

  /**
   * Execute a single named hook with result (for hooks that return data)
   */
  async executeWithResult<K extends HookName>(
    name: K,
    context: HookContext
  ): Promise<{ warnings: string[]; results: unknown[] }> {
    const warnings: string[] = [];
    const results: unknown[] = [];
    const namedHooks = this.hooks[name];
    if (!namedHooks || namedHooks.length === 0) return { warnings, results };

    for (const hook of namedHooks) {
      try {
        const result = await hook(context);
        results.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`[hook:${name}] failed: ${message}`);
        logger.warn(`[hook:${name}] failed`, { runId: context.runId, error: message });
        if (this.throwOnHookError) throw error;
      }
    }

    return { warnings, results };
  }

  /**
   * Register additional hooks dynamically
   */
  register(name: HookName, fn: HookFn): void {
    const current = this.hooks[name] ?? [];
    this.hooks[name] = [...current, fn];
  }

  /**
   * Get all registered hook names
   */
  registeredHooks(): HookName[] {
    return Object.keys(this.hooks) as HookName[];
  }
}

/**
 * Create a default hooks manager with empty hooks.
 * Used when no custom hooks are configured.
 */
export function createDefaultHooksManager(): HooksManager {
  return new HooksManager({ ...defaultHooks }, false);
}

/**
 * Null hooks manager - all hooks are no-ops
 */
export const nullHooksManager = new HooksManager({}, false);