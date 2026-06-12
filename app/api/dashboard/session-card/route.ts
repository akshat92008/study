/**
 * GET /api/dashboard/session-card
 * ================================
 * Returns the single authoritative daily session card for the authenticated user.
 *
 * CONTRACT (always returned):
 * {
 *   hasCard:              boolean
 *   card:                 SessionCardPayload | null
 *   sourceSignals:        SourceSignals
 *   generatedAt:          ISO string
 *   learnerStateVersion:  number
 *   needsOnboarding:      boolean
 * }
 *
 * DETERMINISM RULES:
 *   - One card per (user_id, local_date) — enforced by DB unique constraint.
 *   - LLM prose is disabled by default on dashboard load. If explicitly enabled,
 *     the LLM may only write `focusTopic` (display label) and `rationale` prose.
 *   - All structural fields (target, duration, task type, etc.) are code-computed
 *     by selectSessionCard() before any LLM call.
 *   - Stale cards (learner_state_version mismatch) are deleted and regenerated.
 *   - After state-changing events (session complete, autopsy, card reviewed),
 *     the cache row is deleted, so the next GET regenerates.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import { z } from 'zod';
import { budgetedGenerateJSON } from '@/lib/ai/budgeted';
import {
  selectSessionCard,
  type SelectorInput,
  type SelectorOutput,
} from '@/lib/engines/session-card-selector';
import { getLearnerStateVersion } from '@/lib/services/learner-state-version';
import { logger } from '@/lib/utils/logger';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { betaAccessErrorResponse, requireActiveBetaUser } from '@/lib/access/beta-access';
import { featureDisabledResponse, isFeatureEnabled } from '@/lib/feature-registry';
import { getOrCreateGoalMission } from '@/lib/services/goal-mission.service';
import { getRepairSignals } from '@/lib/services/repair-loop.service';

// ─── Response contract ───────────────────────────────────────────────────────

export interface SessionCardPayload {
  // Identity
  dayNumber: number;
  streakDays: number;
  // Display
  focusTopic: string;
  subject: string;
  estimatedMinutes: number;
  rationale: string;
  // Learner state
  daysToExam: number | null;
  overdueCards: number;
  masteryPercent: number;
  closingMessage?: string;
  // Deterministic signals
  taskType: string;
  resourceType: string;
  targetConceptId: string | null;
  targetMistakeId?: string | null;
  targetRetestId?: string | null;
  repairPhase?: 'immediate_repair' | 'delayed_retest' | null;
  priority: string;
  // Status
  isCompleted: boolean;
  completedAt: string | null;
}

export interface SourceSignals {
  overdueCardCount: number;
  recentMistakeCount: number;
  weakConceptCount: number;
  hasActiveGoal: boolean;
  daysToExam: number | null;
  priorityBucket: string;
  selectionReason: string;
}

export interface SessionCardResponse {
  hasCard: boolean;
  card: SessionCardPayload | null;
  sourceSignals: SourceSignals;
  generatedAt: string;
  learnerStateVersion: number;
  needsOnboarding: boolean;
  adaptationHistory?: Array<{
    version: number;
    reason: string;
    createdAt: string;
  }>;
}

// ─── Zod schema for LLM prose patch ─────────────────────────────────────────

const LLMCardProse = z.object({
  focusTopic: z.string().max(120),
  rationale: z.string().max(400),
  closingMessage: z.string().max(200).optional(),
});

type LLMCardProseType = z.infer<typeof LLMCardProse>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INVALID_TOPIC = new Set([
  'none', 'null', 'undefined', 'n/a', 'na', 'unknown',
  'not set', 'no topic', 'general', '',
]);

function safeTopic(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const t = value.trim();
  if (INVALID_TOPIC.has(t.toLowerCase())) return fallback;
  return t;
}

function getLocalDate(timezone: string | null): string {
  try {
    if (timezone) {
      return new Date()
        .toLocaleDateString('en-CA', { timeZone: timezone }) // YYYY-MM-DD
        .split('T')[0];
    }
  } catch {
    // fall through
  }
  return new Date().toISOString().split('T')[0];
}

function shouldGenerateLLMProse(): boolean {
  return process.env.SESSION_CARD_LLM_PROSE_ENABLED === 'true';
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(request?: Request): Promise<NextResponse> {
  try {
    const requestId = getRequestId(request);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }
    try {
      await requireActiveBetaUser(user.id);
    } catch (accessError) {
      return betaAccessErrorResponse(accessError, requestId) ?? apiErrorResponse('beta_access_required', {
        status: 403,
        message: 'Cognition OS is currently in a limited beta. Ask the admin to activate your beta access.',
        requestId,
      });
    }
    if (!isFeatureEnabled('session_card')) {
      return featureDisabledResponse(requestId);
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'session-card',
      maxTokens: 30,
      windowSeconds: 300,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const generatedAt = new Date().toISOString();
    const { searchParams } = request ? new URL(request.url) : { searchParams: new URLSearchParams() };
    const goalId = searchParams.get('goalId');
    const activeGoal = goalId ? await ensureGoalForUser(supabase, user.id, goalId) : null;

    // ── 1. Read learner_state_version from profile ──────────────────────────
    const learnerStateVersion = await getLearnerStateVersion(user.id, supabase);

    // ── 2. Read profile (includes timezone) ────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'full_name, exam_type, target_date, streak_days, timezone, onboarding_complete, learner_state_version'
      )
      .eq('id', user.id)
      .maybeSingle();

    const localDate = getLocalDate(profile?.timezone ?? null);
    if (goalId) {
      await getOrCreateGoalMission(supabase, user.id, goalId, localDate).catch((err) => {
        logger.warn('session-card: mission self-heal skipped', {
          userId: user.id,
          goalId,
          error: err?.message,
        });
      });
    }

    // ── 3. Check legacy cache and goal cache ─────────────────────────
    let cacheQuery = supabase
      .from('session_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', localDate);
      
    if (goalId) {
      cacheQuery = cacheQuery.eq('goal_id', goalId);
    } else {
      cacheQuery = cacheQuery.is('goal_id', null);
    }

    const { data: cached } = await cacheQuery.maybeSingle();

    // 3b. Fetch adaptation history
    let historyQuery = supabase
      .from('command_session_versions')
      .select('version, adaptation_reason, created_at')
      .eq('user_id', user.id)
      .eq('session_date', localDate);

    if (goalId) {
      historyQuery = historyQuery.eq('goal_id', goalId);
    } else {
      historyQuery = historyQuery.is('goal_id', null);
    }

    const { data: historyData } = await historyQuery.order('version', { ascending: false });

    const adaptationHistory = (historyData || []).map(h => ({
      version: h.version,
      reason: h.adaptation_reason || 'Unknown adaptation',
      createdAt: h.created_at,
    }));

    if (cached && cached.learner_state_version === learnerStateVersion) {
      // Hit — card is valid for today and matches the current learner state.
      const signals: SourceSignals = {
        overdueCardCount: cached.overdueCards ?? 0,
        recentMistakeCount: cached.mistakeCount ?? 0,
        weakConceptCount: cached.weakConceptCount ?? 0,
        hasActiveGoal: Boolean(cached.hasActiveGoal),
        daysToExam: cached.daysToExam ?? null,
        priorityBucket: cached.priority ?? 'unknown',
        selectionReason: cached.selectionReason ?? '',
      };

      return NextResponse.json({
        hasCard: true,
        card: dbRowToPayload(cached),
        sourceSignals: signals,
        generatedAt: cached.created_at ?? generatedAt,
        learnerStateVersion,
        needsOnboarding: false,
        adaptationHistory,
      } satisfies SessionCardResponse);
    }

    if (cached) {
      let staleDelete = supabase
        .from('session_cards')
        .delete()
        .eq('user_id', user.id)
        .eq('date', localDate);

      if (goalId) {
        staleDelete = staleDelete.eq('goal_id', goalId);
      } else {
        staleDelete = staleDelete.is('goal_id', null);
      }

      await staleDelete;
    }

    // ── 4. Fetch all learner signals in parallel ────────────────────────────
    const now = new Date().toISOString();
    let overdueCountQuery = supabase
      .from('revision_cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lte('due', now)
      .neq('state', 4);
    if (goalId) overdueCountQuery = overdueCountQuery.eq('goal_id', goalId);

    let topDueCardQuery = supabase
      .from('revision_cards')
      .select('id, subject, chapter, concept_id, difficulty, lapses')
      .eq('user_id', user.id)
      .lte('due', now)
      .neq('state', 4)
      .order('due', { ascending: true })
      .order('difficulty', { ascending: false })
      .order('stability', { ascending: true })
      .limit(1);
    if (goalId) topDueCardQuery = topDueCardQuery.eq('goal_id', goalId);

    let recentMistakesQuery = supabase
      .from('mistakes')
      .select('id, source, subject, topic, chapter, concept, mistake_text, category, mistake_type, concept_id, severity, status, exam_trap, next_retest_at, created_at')
      .eq('user_id', user.id)
      .in('status', ['open', 'repairing', 'retest_due', 'verified_mistake', 'pending_review'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (goalId) recentMistakesQuery = recentMistakesQuery.eq('goal_id', goalId);

    let weakConceptsQuery = supabase
      .from('concepts')
      .select(
        'id, name, subject, chapter, mastery, mastery_score, forgetting_probability, times_reviewed'
      )
      .eq('user_id', user.id)
      .in('mastery', ['not_started', 'exposed', 'developing'])
      .order('mastery')
      .order('forgetting_probability', { ascending: false })
      .limit(10);
    if (goalId) weakConceptsQuery = weakConceptsQuery.eq('goal_id', goalId);

    let totalConceptsQuery = supabase
      .from('concepts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (goalId) totalConceptsQuery = totalConceptsQuery.eq('goal_id', goalId);

    let masteredConceptsQuery = supabase
      .from('concepts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('mastery', ['mastered', 'automated', 'proficient']);
    if (goalId) masteredConceptsQuery = masteredConceptsQuery.eq('goal_id', goalId);

    let commandTasksQuery = supabase
      .from('daily_microtasks')
      .select('title, type, subject, topic, estimated_minutes, priority, source')
      .eq('user_id', user.id)
      .eq('task_date', localDate)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(5);
    commandTasksQuery = goalId
      ? commandTasksQuery.eq('goal_id', goalId)
      : typeof (commandTasksQuery as any).is === 'function'
        ? (commandTasksQuery as any).is('goal_id', null)
        : commandTasksQuery;

    let patternMemoriesQuery = supabase
      .from('amaura_pattern_memories')
      .select('id, concept_id, pattern, severity, pattern_type, subject, topic')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3);
    if (goalId) patternMemoriesQuery = patternMemoriesQuery.eq('goal_id', goalId);

    const repairSignalsPromise = getRepairSignals(supabase, {
      userId: user.id,
      goalId,
      now,
      limit: 20,
    }).catch(() => ({ dueRetests: [], activeMistakes: [] }));

    let firstSeededTopicQuery = supabase
      .from('goal_curriculum_nodes')
      .select('id, subject, chapter, title, description, order_index, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'not_started', 'in_progress'])
      .order('order_index', { ascending: true })
      .limit(5);

    firstSeededTopicQuery = goalId
      ? firstSeededTopicQuery.eq('goal_id', goalId)
      : typeof (firstSeededTopicQuery as any).is === 'function'
        ? (firstSeededTopicQuery as any).is('goal_id', null)
        : firstSeededTopicQuery;

    const [
      goalRes,
      overdueCountRes,
      topDueCardRes,
      recentMistakesRes,
      weakConceptsRes,
      sessionCountRes,
      studentModelRes,
      totalConceptsRes,
      masteredConceptsRes,
      commandTasksRes,
      patternMemoriesRes,
      firstSeededTopicRes,
      repairSignals,
    ] = await Promise.all([
      activeGoal
        ? Promise.resolve({ data: activeGoal })
        : supabase
            .from('learning_goals')
            .select('id, title, target_date, progress')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

      overdueCountQuery,

      topDueCardQuery.maybeSingle(),

      recentMistakesQuery,

      weakConceptsQuery,

      supabase
        .from('study_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      supabase
        .from('student_models')
        .select('fatigue_threshold_minutes, peak_productivity_hour')
        .eq('user_id', user.id)
        .maybeSingle(),

      totalConceptsQuery,

      masteredConceptsQuery,

      commandTasksQuery,

      patternMemoriesQuery,

      firstSeededTopicQuery,

      repairSignalsPromise,
    ]);

    const overdueCardCount = overdueCountRes.count ?? 0;
    const sessionCount = sessionCountRes.count ?? 0;
    const totalConcepts = totalConceptsRes.count ?? 0;
    const masteredConcepts = masteredConceptsRes.count ?? 0;
    const masteryPercent = totalConcepts
      ? Math.round((masteredConcepts / totalConcepts) * 100)
      : 0;

    // ── 5. Run deterministic selector ───────────────────────────────────────
    const selectorInput: SelectorInput = {
      profile: profile
        ? {
            id: user.id,
            exam_type: profile.exam_type ?? null,
            target_date: profile.target_date ?? null,
            streak_days: profile.streak_days ?? 0,
            timezone: profile.timezone ?? null,
            onboarding_complete: profile.onboarding_complete ?? false,
          }
        : null,
      activeGoal: goalRes.data
        ? {
            id: goalRes.data.id,
            title: goalRes.data.title,
            target_date: goalRes.data.target_date ?? null,
            progress: goalRes.data.progress ?? 0,
          }
        : null,
      overdueCardCount,
      topDueCard: topDueCardRes.data ?? null,
      dueRetests: repairSignals.dueRetests ?? [],
      recentMistakes: (repairSignals.activeMistakes?.length ? repairSignals.activeMistakes : recentMistakesRes.data) ?? [],
      weakConcepts: weakConceptsRes.data ?? [],
      sessionCount,
      studentModel: studentModelRes.data ?? null,
      commandOpenTasks: (commandTasksRes.data ?? []).map((t: any) => ({
        title: t.title,
        type: t.type,
        subject: t.subject,
        chapter: t.topic,
        estimated_minutes: t.estimated_minutes,
        priority: t.priority,
        notes: t.source,
      })),
      patternMemories: (patternMemoriesRes.data ?? []).map((h: any) => ({
        id: h.id,
        concept: h.topic ?? h.pattern_type,
        pattern: h.pattern,
        severity: h.severity,
        action_type: h.pattern_type,
        subject: h.subject,
        topic: h.topic,
      })),
      firstSeededTopic: (firstSeededTopicRes.data && (firstSeededTopicRes.data as any[]).length > 0)
        ? {
            subject: (firstSeededTopicRes.data as any[])[0].subject,
            chapter: (firstSeededTopicRes.data as any[])[0].chapter,
            topic: (firstSeededTopicRes.data as any[])[0].title,
            microtarget: (firstSeededTopicRes.data as any[])[0].description,
          }
        : null,
      now: generatedAt,
    };

    const selection: SelectorOutput = selectSessionCard(selectorInput);

    // Handle onboarding gate
    if (selection.needsOnboarding) {
      const response: SessionCardResponse = {
        hasCard: false,
        card: null,
        sourceSignals: buildSignals(selection, goalRes.data, weakConceptsRes.data?.length ?? 0),
        generatedAt,
        learnerStateVersion,
        needsOnboarding: true,
      };
      return NextResponse.json(response);
    }

    // ── 6. LLM phrasing (optional polish — code drives structure) ───────────
    let llmProse: LLMCardProseType | null = null;

    if (shouldGenerateLLMProse()) {
      const prosePrompt = buildProsePrompt(selection, profile, masteryPercent, goalRes.data?.title ?? null);

      try {
        if (!isFeatureEnabled('ai_global')) {
          throw new Error('AI temporarily paused');
        }
        const raw = await budgetedGenerateJSON<LLMCardProseType>({
          userId: user.id,
          feature: 'session-card',
          route: 'session-card:prose',
          model: 'flash',
          systemPrompt: 'You are a study coach. Return ONLY valid JSON, no markdown or explanation.',
          userPrompt: prosePrompt,
          schema: LLMCardProse,
          maxOutputTokens: 200
        });

        if (raw) {
          llmProse = raw;
        }
      } catch (err: any) {
        if (err.message?.includes('budget') || err.message?.includes('exceeded')) {
          logger.warn('session-card: LLM prose skipped by AI budget guard', {
            userId: user.id,
          });
        } else {
          logger.warn('session-card: LLM prose generation failed, using code fallback', {
            userId: user.id,
            error: err?.message,
          });
        }
        // LLM failure is non-fatal — code values are the source of truth
      }
    }

    // ── 7. Build final card payload ──────────────────────────────────────────
    const focusTopic = safeTopic(
      llmProse?.focusTopic ?? null,
      selection.topic
    );
    const rationale = llmProse?.rationale ?? selection.reason;
    const closingMessage = llmProse?.closingMessage;

    const card: SessionCardPayload = {
      dayNumber: sessionCount + 1,
      streakDays: profile?.streak_days ?? 0,
      focusTopic,
      subject: selection.subject,
      estimatedMinutes: selection.estimatedMinutes,
      rationale,
      daysToExam: selection.daysToExam,
      overdueCards: overdueCardCount,
      masteryPercent,
      closingMessage,
      taskType: selection.taskType,
      resourceType: selection.resourceType,
      targetConceptId: selection.targetConceptId,
      targetMistakeId: selection.targetMistakeId ?? null,
      targetRetestId: selection.targetRetestId ?? null,
      repairPhase: selection.repairPhase ?? null,
      priority: selection.priority,
      isCompleted: false,
      completedAt: null,
    };

    // ── 8. Persist to session_cards (canonical atomic upsert) ───────────────
    const dbRow = {
      user_id: user.id,
      goal_id: goalId,
      date: localDate,
      learner_state_version: learnerStateVersion,
      // payload fields
      dayNumber: card.dayNumber,
      streakDays: card.streakDays,
      focusTopic: card.focusTopic,
      subject: card.subject,
      estimatedMinutes: card.estimatedMinutes,
      rationale: card.rationale,
      daysToExam: card.daysToExam,
      overdueCards: card.overdueCards,
      masteryPercent: card.masteryPercent,
      closingMessage: card.closingMessage ?? null,
      task_type: card.taskType,
      resource_type: card.resourceType,
      target_concept_id: card.targetConceptId,
      priority: card.priority,
      // camelCase aliases for backward compatibility
      taskType: card.taskType,
      resourceType: card.resourceType,
      targetConceptId: card.targetConceptId,
      selectionReason: selection.reason,
      mistakeCount: selection.mistakeCount,
      weakConceptCount: weakConceptsRes.data?.length ?? 0,
      hasActiveGoal: Boolean(goalRes.data),
      // structural fields (snake_case)
      selection_reason: selection.reason,
      mistake_count: selection.mistakeCount,
      weak_concept_count: weakConceptsRes.data?.length ?? 0,
      has_active_goal: Boolean(goalRes.data),
      source_signals: {
        overdueCardCount: selection.dueCardCount,
        recentMistakeCount: selection.mistakeCount,
        weakConceptCount: weakConceptsRes.data?.length ?? 0,
        hasActiveGoal: Boolean(goalRes.data),
        daysToExam: selection.daysToExam,
        priorityBucket: selection.priority,
        selectionReason: selection.reason,
      },
    };

    const { error: upsertError } = await supabase.rpc('upsert_session_card', {
      p_row: dbRow,
    });

    if (upsertError) {
      logger.error('session-card: failed to persist card via RPC', {
        userId: user.id,
        goalId,
        localDate,
        error: upsertError.message,
        requestId,
      });
      return apiErrorResponse('session_card_persist_failed', {
        status: 500,
        message: 'Unable to save today\'s session card.',
        requestId,
      });
    }

    const response: SessionCardResponse = {
      hasCard: true,
      card,
      sourceSignals: buildSignals(selection, goalRes.data, weakConceptsRes.data?.length ?? 0),
      generatedAt,
      learnerStateVersion,
      needsOnboarding: false,
      adaptationHistory,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return unexpectedApiErrorResponse(request, error, 'session-card', 'Unable to build today\'s session card.');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSignals(
  sel: SelectorOutput,
  goal: { title: string } | null | undefined,
  weakConceptCount = 0
): SourceSignals {
  return {
    overdueCardCount: sel.dueCardCount,
    recentMistakeCount: sel.mistakeCount,
    weakConceptCount,
    hasActiveGoal: Boolean(goal),
    daysToExam: sel.daysToExam,
    priorityBucket: sel.priority,
    selectionReason: sel.reason,
  };
}

function dbRowToPayload(row: any): SessionCardPayload {
  return {
    dayNumber: row.dayNumber ?? row.day_number ?? 1,
    streakDays: row.streakDays ?? row.streak_days ?? 0,
    focusTopic: row.focusTopic ?? row.focus_topic ?? '',
    subject: row.subject ?? '',
    estimatedMinutes: row.estimatedMinutes ?? row.estimated_minutes ?? 45,
    rationale: row.rationale ?? '',
    daysToExam: row.daysToExam ?? row.days_to_exam ?? null,
    overdueCards: row.overdueCards ?? row.overdue_cards ?? 0,
    masteryPercent: row.masteryPercent ?? row.mastery_percent ?? 0,
    closingMessage: row.closingMessage ?? row.closing_message ?? undefined,
    taskType: row.taskType ?? row.task_type ?? 'concept_study',
    resourceType: row.resourceType ?? row.resource_type ?? 'practice_questions',
    targetConceptId: row.targetConceptId ?? row.target_concept_id ?? null,
    targetMistakeId: row.targetMistakeId ?? row.target_mistake_id ?? null,
    targetRetestId: row.targetRetestId ?? row.target_retest_id ?? null,
    repairPhase: row.repairPhase ?? row.repair_phase ?? null,
    priority: row.priority ?? 'concept_study',
    isCompleted: row.isCompleted ?? row.is_completed ?? false,
    completedAt: row.completedAt ?? row.completed_at ?? null,
  };
}

function buildProsePrompt(
  sel: SelectorOutput,
  profile: any,
  masteryPercent: number,
  activeGoalTitle?: string | null
): string {
  // Universal: use goal title if available, otherwise infer from exam_type, else generic
  const learnerContext = activeGoalTitle
    ? `"${activeGoalTitle}" goal`
    : (profile?.exam_type && profile.exam_type !== 'General Study')
      ? `${profile.exam_type} preparation`
      : 'their learning goal';

  return `You are a study session coach helping a learner with ${learnerContext}.

The algorithm has ALREADY decided the following (do NOT change these):
- Target topic: ${sel.topic}
- Subject: ${sel.subject}
- Priority: ${sel.priority}
- Duration: ${sel.estimatedMinutes} minutes
- Reason: ${sel.reason}
- Current overall mastery: ${masteryPercent}%

Your ONLY job is to write friendly display text in JSON:
{
  "focusTopic": "<concise 3-8 word label for the topic, specific, never vague>",
  "rationale": "<1 sentence, motivating and specific, ≤100 words>",
  "closingMessage": "<optional short encouragement, ≤20 words>"
}

Rules:
- focusTopic MUST be a specific topic or concept name — never "General Study", "null", or "N/A".
- If the target topic is just the name of an exam or goal (e.g. "NEET exam"), do NOT invent random subjects like "Biology Syllabus" unless it is explicitly specified. Use the target topic as given or rephrase it slightly.
- If the topic is "${sel.topic}", keep it or make it more specific ONLY IF the context provides specifics, never more vague. Do NOT hallucinate new subjects.
- rationale must mention the specific reason (${sel.priority.replace('_', ' ')}).
- Return ONLY valid JSON. No markdown, no backticks, no preamble.`;
}
