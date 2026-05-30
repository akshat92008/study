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
 *   - The LLM only writes `focusTopic` (display label) and `rationale` prose.
 *   - All structural fields (target, duration, task type, etc.) are code-computed
 *     by selectSessionCard() before any LLM call.
 *   - Stale cards (learner_state_version mismatch) are deleted and regenerated.
 *   - After state-changing events (session complete, autopsy, card reviewed),
 *     the cache row is deleted, so the next GET regenerates.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider-client';
import { z } from 'zod';
import {
  assertDailyAIUsageBudget,
  isAIUsageBudgetExceeded,
  trackDailyAIUsage,
} from '@/lib/services/ai-usage.service';
import {
  selectSessionCard,
  type SelectorInput,
  type SelectorOutput,
} from '@/lib/engines/session-card-selector';
import { getLearnerStateVersion } from '@/lib/services/learner-state-version';
import { logger } from '@/lib/utils/logger';

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

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const generatedAt = new Date().toISOString();

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

    // ── 3. Check cache ──────────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from('session_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', localDate)
      .maybeSingle();

    if (
      cached &&
      Number(cached.learner_state_version ?? 0) === learnerStateVersion
    ) {
      // Hit — card is still valid for today
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
      } satisfies SessionCardResponse);
    }

    // ── 4. Fetch all learner signals in parallel ────────────────────────────
    const now = new Date().toISOString();

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
    ] = await Promise.all([
      supabase
        .from('learning_goals')
        .select('id, title, target_date, progress')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('revision_cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lte('due', now)
        .neq('state', 4),

      supabase
        .from('revision_cards')
        .select('id, subject, chapter, concept_id, difficulty, lapses')
        .eq('user_id', user.id)
        .lte('due', now)
        .neq('state', 4)
        .order('due', { ascending: true })
        .order('difficulty', { ascending: false })
        .order('stability', { ascending: true })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('mistakes')
        .select('id, subject, chapter, category, concept_id, created_at')
        .eq('user_id', user.id)
        .gte(
          'created_at',
          new Date(Date.now() - 7 * 86_400_000).toISOString()
        )
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('concepts')
        .select(
          'id, name, subject, chapter, mastery, mastery_score, forgetting_probability, times_reviewed'
        )
        .eq('user_id', user.id)
        .in('mastery', ['not_started', 'exposed', 'developing'])
        .order('mastery')
        .order('forgetting_probability', { ascending: false })
        .limit(10),

      supabase
        .from('study_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      supabase
        .from('student_models')
        .select('fatigue_threshold_minutes, peak_productivity_hour')
        .eq('user_id', user.id)
        .maybeSingle(),

      supabase
        .from('concepts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      supabase
        .from('concepts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('mastery', ['mastered', 'automated', 'proficient']),
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
      activeGoal: goalRes.data ?? null,
      overdueCardCount,
      topDueCard: topDueCardRes.data ?? null,
      recentMistakes: recentMistakesRes.data ?? [],
      weakConcepts: weakConceptsRes.data ?? [],
      sessionCount,
      studentModel: studentModelRes.data ?? null,
      now: generatedAt,
    };

    const selection: SelectorOutput = selectSessionCard(selectorInput);

    // Handle onboarding gate
    if (selection.needsOnboarding) {
      const response: SessionCardResponse = {
        hasCard: false,
        card: null,
        sourceSignals: buildSignals(selection, goalRes.data),
        generatedAt,
        learnerStateVersion,
        needsOnboarding: true,
      };
      return NextResponse.json(response);
    }

    // ── 6. LLM phrasing (optional polish — code drives structure) ───────────
    let llmProse: LLMCardProseType | null = null;

    const prosePrompt = buildProsePrompt(selection, profile, masteryPercent);

    try {
      await assertDailyAIUsageBudget({
        userId: user.id,
        kind: 'session-card',
        estimatedPromptTokens: Math.ceil(prosePrompt.length / 4),
        estimatedCompletionTokens: 200,
      });

      const raw = await generateJSON<LLMCardProseType>(
        'flash',
        'You are a study coach. Return ONLY valid JSON, no markdown or explanation.',
        prosePrompt
      );

      if (raw && typeof raw.focusTopic === 'string' && typeof raw.rationale === 'string') {
        llmProse = raw;
        await trackDailyAIUsage({
          userId: user.id,
          kind: 'session-card',
          route: '/api/dashboard/session-card',
          model: 'flash',
          promptTokens: Math.ceil(prosePrompt.length / 4),
          completionTokens: Math.ceil(JSON.stringify(raw).length / 4),
        });
      }
    } catch (err: any) {
      if (!isAIUsageBudgetExceeded(err)) {
        logger.warn('session-card: LLM prose generation failed, using code fallback', {
          userId: user.id,
          error: err?.message,
        });
      }
      // LLM failure is non-fatal — code values are the source of truth
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
      priority: selection.priority,
      isCompleted: false,
      completedAt: null,
    };

    // ── 8. Persist to session_cards (upsert) ─────────────────────────────────
    const dbRow = {
      user_id: user.id,
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
      taskType: card.taskType,
      resourceType: card.resourceType,
      targetConceptId: card.targetConceptId,
      priority: card.priority,
      isCompleted: false,
      completedAt: null,
      // source signals (stored for cache re-hydration)
      selectionReason: selection.reason,
      mistakeCount: selection.mistakeCount,
      weakConceptCount: weakConceptsRes.data?.length ?? 0,
      hasActiveGoal: Boolean(goalRes.data),
    };

    const { error: upsertError } = await supabase
      .from('session_cards')
      .upsert(dbRow, { onConflict: 'user_id,date' });

    if (upsertError) {
      logger.warn('session-card: failed to upsert card to cache', {
        userId: user.id,
        error: upsertError.message,
      });
    }

    const response: SessionCardResponse = {
      hasCard: true,
      card,
      sourceSignals: buildSignals(selection, goalRes.data),
      generatedAt,
      learnerStateVersion,
      needsOnboarding: false,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logger.error('session-card: unhandled error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSignals(
  sel: SelectorOutput,
  goal: { title: string } | null | undefined
): SourceSignals {
  return {
    overdueCardCount: sel.dueCardCount,
    recentMistakeCount: sel.mistakeCount,
    weakConceptCount: sel.weakConcepts?.length ?? 0,
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
    priority: row.priority ?? 'concept_study',
    isCompleted: row.isCompleted ?? row.is_completed ?? false,
    completedAt: row.completedAt ?? row.completed_at ?? null,
  };
}

function buildProsePrompt(
  sel: SelectorOutput,
  profile: any,
  masteryPercent: number
): string {
  return `You are a study session coach for a ${profile?.exam_type ?? 'competitive exam'} student.

The algorithm has ALREADY decided the following (do NOT change these):
- Target topic: ${sel.topic}
- Subject: ${sel.subject}
- Priority: ${sel.priority}
- Duration: ${sel.estimatedMinutes} minutes
- Reason: ${sel.reason}

Your ONLY job is to write friendly display text in JSON:
{
  "focusTopic": "<concise 3-8 word label for the topic, specific, never vague>",
  "rationale": "<1 sentence, motivating and specific, ≤100 words>",
  "closingMessage": "<optional short encouragement, ≤20 words>"
}

Rules:
- focusTopic MUST be a real chapter or concept name — never "General Study", "null", or "N/A".
- If the topic is "${sel.topic}", keep it or make it more specific, never more vague.
- rationale must mention the specific reason (${sel.priority.replace('_', ' ')}).
- Return ONLY valid JSON. No markdown, no backticks, no preamble.`;
}
