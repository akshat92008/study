/**
 * Context management for the agent runtime.
 * Builds and maintains context across the agent loop iterations.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentChannel, AgentContextSummary, JsonObject } from './types';
import type { AgentSkill } from './skills/skillTypes';
import { logger } from '@/lib/utils/logger';

export interface AgentRuntimeContext {
  supabase: SupabaseClient;
  userId: string;
  channel: AgentChannel;
  conversationId?: string | null;
  sessionId?: string | null;
  goalId?: string | null;
  runId?: string | null;
  idempotencyKey: string;
  now: Date;
  // Runtime state
  contextSummary?: AgentContextSummary;
  sourceChunks?: JsonObject[];
  learningSignals?: JsonObject[];
  skills?: AgentSkill[];
  observations: string[];  // For iteration feedback
  toolResults: JsonObject[]; // For iteration feedback
  warnings: string[];
}

/**
 * Build initial context for the agent runtime
 */
export function buildInitialContext(input: {
  supabase: SupabaseClient;
  userId: string;
  channel: AgentChannel;
  conversationId?: string | null;
  sessionId?: string | null;
  goalId?: string | null;
  runId?: string | null;
  idempotencyKey: string;
  now?: Date;
}): AgentRuntimeContext {
  return {
    supabase: input.supabase,
    userId: input.userId,
    channel: input.channel,
    conversationId: input.conversationId ?? null,
    sessionId: input.sessionId ?? null,
    goalId: input.goalId ?? null,
    runId: input.runId ?? null,
    idempotencyKey: input.idempotencyKey,
    now: input.now ?? new Date(),
    observations: [],
    toolResults: [],
    warnings: [],
  };
}

/**
 * Update context with new observations and tool results.
 * Called after each iteration of the loop.
 */
export function updateContext(
  context: AgentRuntimeContext,
  update: {
    contextSummary?: AgentContextSummary;
    sourceChunks?: JsonObject[];
    learningSignals?: JsonObject[];
    observation?: string;
    toolResult?: JsonObject;
    warnings?: string[];
  }
): AgentRuntimeContext {
  const updated = { ...context };

  if (update.contextSummary !== undefined) {
    updated.contextSummary = update.contextSummary;
  }
  if (update.sourceChunks !== undefined) {
    updated.sourceChunks = update.sourceChunks;
  }
  if (update.learningSignals !== undefined) {
    updated.learningSignals = update.learningSignals;
  }
  if (update.observation !== undefined) {
    updated.observations = [...updated.observations, update.observation];
  }
  if (update.toolResult !== undefined) {
    updated.toolResults = [...updated.toolResults, update.toolResult];
  }
  if (update.warnings !== undefined) {
    updated.warnings = [...updated.warnings, ...update.warnings];
  }

  return updated;
}

/**
 * Load relevant skills for the current context.
 * Returns top matching skills based on concept/channel/goal scope.
 */
export async function loadSkillsForContext(
  context: AgentRuntimeContext
): Promise<AgentSkill[]> {
  try {
    // Use two queries: user's own skills + global skills, then merge
    const { data: userSkills, error: uErr } = await context.supabase
      .from('agent_skills')
      .select('*')
      .eq('status', 'active')
      .eq('user_id', context.userId)
      .order('success_count', { ascending: false })
      .limit(5);

    const { data: globalSkills, error: gErr } = await context.supabase
      .from('agent_skills')
      .select('*')
      .eq('status', 'active')
      .eq('scope', 'global')
      .order('success_count', { ascending: false })
      .limit(5);

    const err = uErr || gErr;
    if (err) {
      logger.warn('Failed to load skills for context', { userId: context.userId, error: err.message });
      return [];
    }

    const goalId = context.goalId;
    const combined = [...(userSkills ?? []), ...(globalSkills ?? [])] as unknown as AgentSkill[];

    // Remove duplicates and filter
    const seen = new Set<string>();
    const filtered = combined.filter((skill) => {
      // Already included via direct user match above, skip global duplicate
      if (skill.scope === 'global') return true;
      if (skill.scope === 'user' && skill.user_id === context.userId) {
        if (seen.has(skill.id)) return false;
        seen.add(skill.id);
        return true;
      }
      if (skill.scope === 'goal' && goalId && skill.goal_id === goalId) {
        if (seen.has(skill.id)) return false;
        seen.add(skill.id);
        return true;
      }
      return false;
    });

    // Sort by success_count descending and limit
    return filtered
      .sort((a, b) => b.success_count - a.success_count)
      .slice(0, 5);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('Skill loading failed', { userId: context.userId, error: msg });
    return [];
  }
}

/**
 * Build context for skill retrieval query
 */
export function buildSkillQueryContext(context: AgentRuntimeContext): JsonObject {
  return {
    userId: context.userId,
    channel: context.channel,
    goalId: context.goalId,
    sessionId: context.sessionId,
    hasContext: Boolean(context.contextSummary),
    weakConceptCount: context.contextSummary?.atlas
      ? (context.contextSummary.atlas as any)?.weakConcepts?.length ?? 0
      : 0,
    dueCardCount: context.contextSummary?.memory
      ? (context.contextSummary.memory as any)?.dueCount ?? 0
      : 0,
  };
}

/**
 * Format context for LLM/system prompt injection.
 * Produces a concise summary of current agent state.
 */
export function formatContextForPrompt(context: AgentRuntimeContext): string {
  const parts: string[] = [];

  if (context.contextSummary) {
    const summary = context.contextSummary;
    if (summary.profile) parts.push(`Profile: ${(summary.profile as any)?.full_name ?? context.userId}`);
    if (summary.activeGoal) parts.push(`Goal: ${(summary.activeGoal as any)?.title ?? 'unknown'}`);
    if (summary.atlas) {
      const weakCount = (summary.atlas as any)?.weakConcepts?.length ?? 0;
      if (weakCount > 0) parts.push(`${weakCount} weak concept(s) in ATLAS`);
    }
    if (summary.memory) {
      const dueCount = (summary.memory as any)?.dueCount ?? 0;
      if (dueCount > 0) parts.push(`${dueCount} MEMORY card(s) due`);
    }
  }

  if (context.observations.length > 0) {
    parts.push(`Recent observations: ${context.observations.slice(-3).join('; ')}`);
  }

  if (context.skills && context.skills.length > 0) {
    parts.push(`${context.skills.length} relevant skill(s) loaded`);
  }

  if (parts.length === 0) return 'No context loaded yet.';
  return parts.join('\n');
}