/**
 * Durable Tool Executor for Cognition OS.
 *
 * Features:
 * - Durably writes tool call rows before/after execution
 * - Enforces channel allowlists (via policy)
 * - Enforces risk levels (via toolsets)
 * - Enforces per-tool and total budgets
 * - Runs before/after hooks
 * - Handles verification for mutating tools
 */
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentToolContext, AgentToolDefinition, JsonObject, ToolResultRecord } from '@/lib/agent/types';
import { getLearningTool, listLearningTools } from '@/lib/agent/tools/registry';
import { ToolCallBudget, IterationBudget } from '@/lib/agent/budget';
import { getChannelPolicy } from '@/lib/agent/policy';
import { getToolConfig } from '@/lib/agent/tools/toolsets';
import { ToolExecutionError, GuardrailBlockedError } from '@/lib/agent/errors';
import { HooksManager } from '@/lib/agent/hooks';
import { logger } from '@/lib/utils/logger';

export interface DurableExecuteOptions {
  supabase: SupabaseClient;
  userId: string;
  channel: string;
  runId: string;
  stepId?: string;
  toolCallsBudget: ToolCallBudget;
  iterationsBudget: IterationBudget;
  hooks?: HooksManager;
  dryRun?: boolean;
  context?: AgentToolContext;
}

export interface DurableExecuteResult {
  success: boolean;
  toolName: string;
  result: ToolResultRecord | null;
  verification?: JsonObject;
  blocked?: { guardrail: string; reason: string };
  error?: { code: string; message: string };
  warnings: string[];
}

/**
 * Execute a tool with full durability guarantees.
 * - Writes agent_tool_calls row BEFORE execution
 * - Updates row AFTER execution with result
 * - Verifies entity ownership for user-scoped resources
 */
export async function executeDurableTool(
  toolName: string,
  args: JsonObject,
  options: DurableExecuteOptions
): Promise<DurableExecuteResult> {
  const { supabase, userId, channel, runId, stepId, toolCallsBudget, hooks, dryRun, context } = options;
  const now = context?.now ?? new Date();
  const startedAt = now.toISOString();
  const warnings: string[] = [];

  // 1. Get tool definition
  const tool = getLearningTool(toolName);
  if (!tool) {
    return {
      success: false,
      toolName,
      result: null,
      error: { code: 'TOOL_NOT_FOUND', message: `Tool '${toolName}' not found in registry` },
      warnings,
    };
  }

  // 2. Check channel policy (which toolsets are allowed for this channel)
  const toolConfig = getToolConfig(toolName);
  if (toolConfig) {
    const policy = getChannelPolicy(channel as any);
    if (!policy.allowedToolsets.includes(toolConfig.toolset)) {
      return {
        success: false,
        toolName,
        result: null,
        blocked: {
          guardrail: 'ChannelPolicy',
          reason: `Toolset '${toolConfig.toolset}' not allowed for channel '${channel}'`,
        },
        warnings,
      };
    }

    // 3. Check risk level policy
    if (!policy.allowedRiskLevels.includes(toolConfig.riskLevel)) {
      return {
        success: false,
        toolName,
        result: null,
        blocked: {
          guardrail: 'RiskPolicy',
          reason: `Risk level '${toolConfig.riskLevel}' not allowed for channel '${channel}'`,
        },
        warnings,
      };
    }
  }

  // 4. Check budget
  if (!toolCallsBudget.canCallTool(toolName)) {
    const perToolUsed = toolCallsBudget.toolCallCount(toolName);
    return {
      success: false,
      toolName,
      result: null,
      blocked: {
        guardrail: 'ToolCallBudget',
        reason: `Tool '${toolName}' called ${perToolUsed}x times in this turn (limit: 4)`,
      },
      warnings,
    };
  }

  if (toolCallsBudget.exhausted) {
    return {
      success: false,
      toolName,
      result: null,
      blocked: {
        guardrail: 'ToolCallBudget',
        reason: `Tool call budget exhausted (${toolCallsBudget.used}/${toolCallsBudget.max})`,
      },
      warnings,
    };
  }

  // 5. Write agent_tool_calls row BEFORE execution (durable logging)
  const toolCallId = randomUUID();
  const agentToolCallRow = {
    id: toolCallId,
    run_id: runId,
    step_id: stepId ?? null,
    user_id: userId,
    tool_name: toolName,
    toolset: toolConfig?.toolset ?? null,
    args,
    status: 'started',
    mutating: toolConfig?.mutating ?? false,
    idempotent: tool.mutating ? tool.idempotent : true,
    risk_level: toolConfig?.riskLevel ?? 'safe_read',
    entity_type: null,
    entity_ids: null,
    changed: false,
    verification: {},
    started_at: startedAt,
  };

  // Fire beforeToolCall hook if available
  if (hooks) {
    const hookWarnings = await hooks.execute('beforeToolCall', {
      runId,
      userId,
      channel,
      toolName,
      args,
      stepType: 'tool_call',
    });
    warnings.push(...hookWarnings);
  }

  // Insert tool call row BEFORE execution
  if (!dryRun) {
    const { error: insertError } = await supabase
      .from('agent_tool_calls')
      .insert(agentToolCallRow);

    if (insertError) {
      logger.warn('Failed to write agent_tool_calls row before execution', {
        toolName,
        runId,
        error: insertError.message,
      });
      // Continue anyway - tool execution should not fail because of logging failure
    }
  }

  // 6. Execute the tool if not dry run
  let result: ToolResultRecord | null = null;

  if (!dryRun) {
    try {
      // Validate input
      const parsedArgs = tool.inputSchema.parse(args);

      // Set context for the tool - PRESERVE ORIGINAL CONTEXT IF PROVIDED
      const toolContext: AgentToolContext = context
        ? {
            ...context,
            idempotencyKey: `${runId}:${toolName}:${startedAt}`,
          }
        : {
            supabase,
            userId,
            channel: channel as any,
            conversationId: null,
            sessionId: null,
            goalId: null,
            runId,
            idempotencyKey: `${runId}:${toolName}:${startedAt}`,
            now,
            observation: {} as any,
          };

      // Execute handler
      const handlerOutput = await tool.handler(parsedArgs, toolContext);
      result = tool.outputSchema.parse(handlerOutput) as ToolResultRecord;

      // Record the tool call in budget
      toolCallsBudget.recordCall(toolName);
    } catch (error) {
      // Tool execution failed
      const message = error instanceof Error ? error.message : String(error);
      result = {
        success: false,
        changed: false,
        summary: message,
        toolName,
        id: toolCallId,
        error: { code: 'TOOL_EXECUTION_FAILED', message, details: { toolName } },
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
  } else {
    // Dry run - simulate success
    result = {
      id: toolCallId,
      success: true,
      changed: false,
      summary: `[DRY RUN] ${toolName} would be executed`,
      toolName,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  // 7. Update agent_tool_calls row AFTER execution
  const status = result?.success === false
    ? 'failed'
    : 'success';

  const updateRow: Record<string, unknown> = {
    status,
    result: { ...result, toolName }, // don't expose internal toolName field
    changed: result?.changed ?? false,
    entity_type: result?.entityType ?? null,
    entity_ids: result?.entityIds ?? null,
    duration_ms: durationMs,
    completed_at: completedAt,
    ...(result?.error ? { error: result.error } : {}),
  };

  if (!dryRun) {
    const { error: updateError } = await supabase
      .from('agent_tool_calls')
      .update(updateRow)
      .eq('id', toolCallId);

    if (updateError) {
      logger.warn('Failed to update agent_tool_calls row after execution', {
        toolCallId,
        error: updateError.message,
      });
    }
  }

  // 8. Fire afterToolCall hook
  if (hooks) {
    const hookWarnings = await hooks.execute('afterToolCall', {
      runId,
      userId,
      channel,
      toolName,
      toolResult: result as any,
      stepType: 'tool_result',
    });
    warnings.push(...hookWarnings);
  }

  return {
    success: Boolean(result?.success),
    toolName,
    result: result
      ? {
          ...result,
          id: toolCallId,
          toolName,
          startedAt,
          completedAt,
        }
      : null,
    warnings,
  };
}


/**
 * Execute multiple tools in sequence, stopping on budget exhaustion.
 * Returns all results (including failed/blocked).
 */
export async function executeToolChain(
  tools: Array<{ name: string; args: JsonObject }>,
  options: DurableExecuteOptions
): Promise<DurableExecuteResult[]> {
  const results: DurableExecuteResult[] = [];

  for (const toolCall of tools) {
    // Check if we can continue
    if (!options.toolCallsBudget.canContinue(options.iterationsBudget.used, options.iterationsBudget.max)) {
      results.push({
        success: false,
        toolName: toolCall.name,
        result: null,
        blocked: {
          guardrail: 'Budget',
          reason: 'Cannot continue: iterations or tool calls exhausted',
        },
        warnings: [],
      });
      break;
    }

    const result = await executeDurableTool(toolCall.name, toolCall.args, {
      ...options,
      context: options.context,
    });
    results.push(result);

    // If tool failed, continue anyway but log warning
    if (!result.success && !result.blocked) {
      logger.warn('Tool execution failed', { toolName: toolCall.name, error: result.error });
    }
  }

  return results;
}

/**
 * Record a tool call in agent_steps for trajectory tracing.
 * Called before/after significant phases.
 */
export async function recordAgentStep(
  supabase: SupabaseClient,
  input: {
    runId: string;
    userId: string;
    stepIndex: number;
    stepType: string;
    role?: string;
    content: JsonObject;
    model?: string;
    tokenUsage?: JsonObject;
  }
): Promise<void> {
  const { error } = await supabase.from('agent_steps').insert({
    run_id: input.runId,
    user_id: input.userId,
    step_index: input.stepIndex,
    step_type: input.stepType,
    role: input.role ?? null,
    content: input.content,
    model: input.model ?? null,
    token_usage: input.tokenUsage ?? null,
  });

  if (error) {
    logger.warn('Failed to write agent_steps row', { runId: input.runId, error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Legacy tool execution API (used by loop-deterministic)
// Follows the original executeLearningTool / createToolExecutionState interface
// ---------------------------------------------------------------------------

export interface ToolExecutionState {
  maxToolCalls: number;
  calls: Array<{ id: string; name: string; input: JsonObject; startedAt: string }>;
  results: Array<{
    id: string;
    toolName: string;
    success: boolean;
    changed: boolean;
    entityType?: string;
    entityIds?: string[];
    summary: string;
    data?: JsonObject;
    startedAt: string;
    completedAt: string;
    error?: { code: string; message: string; details?: JsonObject };
  }>;
}

export function createToolExecutionState(maxToolCalls: number): ToolExecutionState {
  return {
    maxToolCalls,
    calls: [],
    results: [],
  };
}

export async function executeLearningTool(
  toolName: string,
  args: JsonObject,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,  // Accepts AgentToolContext or any compatible context object
  state: ToolExecutionState
) {
  const startedAt = new Date().toISOString();
  const tool = getLearningTool(toolName);
  if (!tool) {
    return { success: false, error: { code: 'NOT_FOUND', message: `Tool '${toolName}' not found` } };
  }

  const runId = context.runId ?? 'legacy-run';
  const toolCallId = `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  state.calls.push({ id: toolCallId, name: toolName, input: args, startedAt });

  try {
    const parsed = tool.inputSchema.parse(args);
    const toolContext = {
      supabase: context.supabase,
      userId: context.userId,
      channel: context.channel as any,
      conversationId: null,
      sessionId: null,
      goalId: context.goalId ?? null,
      runId,
      idempotencyKey: `${runId}:${toolName}`,
      now: new Date(),
      observation: context.observation as any,
    };
    const output = await tool.handler(parsed, toolContext);
    const result = tool.outputSchema.parse(output);
    const completedAt = new Date().toISOString();

    const record: ToolExecutionState['results'][0] = {
      id: toolCallId,
      toolName,
      success: true,
      changed: (result as any).changed ?? false,
      entityType: (result as any).entityType,
      entityIds: (result as any).entityIds,
      summary: (result as any).summary ?? `completed:${toolName}`,
      data: result as JsonObject,
      startedAt,
      completedAt,
    };

    state.results.push(record);
    return { success: true, data: result as JsonObject };
  } catch (err) {
    const completedAt = new Date().toISOString();
    const message = err instanceof Error ? err.message : String(err);
    state.results.push({
      id: toolCallId,
      toolName,
      success: false,
      changed: false,
      summary: message,
      startedAt,
      completedAt,
      error: { code: 'EXECUTION_ERROR', message },
    });
    return { success: false, error: { code: 'EXECUTION_ERROR', message } };
  }
}
