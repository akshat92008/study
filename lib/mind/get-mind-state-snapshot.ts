import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveActiveGoalForUser } from '@/lib/goals/resolve-active-goal';
import { getAvailableSources } from '@/lib/sources/getAvailableSources';
import { retrieveSourceChunks } from '@/lib/sources/retrieveSourceChunks';

export interface MindStateSnapshot {
  user: { id: string; examType: string | null; streakDays: number; lastActiveAt: string | null };
  activeGoal: Record<string, unknown> | null;
  todaySession: Record<string, unknown> | null;
  atlas: {
    weakConcepts: any[];
    recentlyImprovedConcepts: any[];
    recentlyPracticedConcepts: any[];
    masteredConcepts: any[];
    conceptAliases: any[];
  };
  memory: { dueCards: any[]; recentlyReviewedCards: any[]; createdToday: any[] };
  autopsy: { recentAssessments: any[]; unresolvedMistakes: any[]; recoverableMistakes: any[]; failedParses: any[] };
  sources: { indexedSources: any[]; relevantChunks: any[]; failedSources: any[]; pendingSources: any[] };
  recentLearningEvents: any[];
  recentChatTurns: any[];
  guardrails: {
    doNotRepeatConceptIds: string[];
    preferredNextConceptIds: string[];
    mustUseSessionObjective: boolean;
    sourceGroundingAvailable: boolean;
  };
}

function localDate(now: Date, timezone?: string | null) {
  try {
    return timezone
      ? now.toLocaleDateString('en-CA', { timeZone: timezone })
      : now.toISOString().slice(0, 10);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export async function getMindStateSnapshot(
  supabase: SupabaseClient,
  input: {
    userId: string;
    goalId?: string | null;
    sessionId?: string | null;
    message?: string;
    now?: Date;
  }
): Promise<MindStateSnapshot> {
  const now = input.now ?? new Date();
  const active = await resolveActiveGoalForUser(supabase, input.userId, input.goalId);
  const goalId = active.goalId;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, exam_type, streak_days, last_active_at, timezone')
    .eq('id', input.userId)
    .single();
  if (profileError) throw profileError;
  const today = localDate(now, profile.timezone);
  const todayStart = `${today}T00:00:00.000Z`;

  const goalScoped = (query: any) => goalId ? query.eq('goal_id', goalId) : query.is('goal_id', null);
  const [sessionRes, conceptsRes, dueCardsRes, reviewedCardsRes, createdCardsRes, assessmentsRes, mistakesRes, eventsRes, chatRes] = await Promise.all([
    goalScoped(supabase.from('session_cards').select('*').eq('user_id', input.userId).eq('date', today)).maybeSingle(),
    goalScoped(supabase.from('concepts').select('id, name, subject, chapter, topic, mastery, mastery_score, last_reviewed_at, updated_at').eq('user_id', input.userId)).order('updated_at', { ascending: false }).limit(80),
    goalScoped(supabase.from('revision_cards').select('id, concept_id, front, due, state, updated_at').eq('user_id', input.userId).lte('due', now.toISOString()).neq('state', 4)).order('due', { ascending: true }).limit(20),
    goalScoped(supabase.from('revision_cards').select('id, concept_id, front, last_review_at, state').eq('user_id', input.userId).not('last_review_at', 'is', null)).order('last_review_at', { ascending: false }).limit(10),
    goalScoped(supabase.from('revision_cards').select('id, concept_id, front, created_at, state').eq('user_id', input.userId).gte('created_at', todayStart)).order('created_at', { ascending: false }).limit(20),
    goalScoped(supabase.from('assessments').select('id, title, status, extraction_status, created_at').eq('user_id', input.userId)).order('created_at', { ascending: false }).limit(10),
    goalScoped(supabase.from('mistakes').select('id, concept_id, concept, topic, status, severity, created_at').eq('user_id', input.userId).in('status', ['open', 'repairing', 'retest_due', 'verified_mistake'])).order('created_at', { ascending: false }).limit(20),
    supabase.from('learner_events').select('id, event_type, event_data, created_at').eq('user_id', input.userId).order('created_at', { ascending: false }).limit(30),
    input.sessionId
      ? supabase.from('chat_messages').select('id, role, content, metadata, created_at').eq('user_id', input.userId).eq('session_id', input.sessionId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [sessionRes, conceptsRes, dueCardsRes, reviewedCardsRes, createdCardsRes, assessmentsRes, mistakesRes, eventsRes, chatRes]) {
    if (result.error) throw result.error;
  }

  const indexedSources = await getAvailableSources(supabase, input.userId);
  const { data: allSources, error: sourcesError } = await supabase
    .from('study_materials')
    .select('id, title, status, goal_id, last_error, created_at')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (sourcesError) throw sourcesError;

  const relevantChunks = input.message?.trim() && indexedSources.length > 0
    ? (await retrieveSourceChunks(supabase, input.userId, input.message, { goalId, limit: 5 })).chunks
    : [];

  const concepts = conceptsRes.data ?? [];
  const recentEvents = eventsRes.data ?? [];
  const recentlyPracticedIds = new Set<string>();
  const correctlyAnsweredIds = new Set<string>();
  for (const event of recentEvents) {
    const data = event.event_data ?? {};
    const conceptId = data.metadata?.conceptId ?? data.conceptId ?? data.targetId;
    if (typeof conceptId === 'string') recentlyPracticedIds.add(conceptId);
    if (typeof conceptId === 'string' && (data.correct === true || data.metadata?.outcome === 'correct')) {
      correctlyAnsweredIds.add(conceptId);
    }
  }

  const weakConcepts = concepts.filter((concept: any) => Number(concept.mastery_score ?? 0) < 45);
  const recentlyImproved = concepts.filter((concept: any) => ['developing', 'proficient'].includes(concept.mastery)).slice(0, 10);
  const mastered = concepts.filter((concept: any) => Number(concept.mastery_score ?? 0) >= 85);
  const mistakes = mistakesRes.data ?? [];

  return {
    user: {
      id: input.userId,
      examType: profile.exam_type ?? null,
      streakDays: profile.streak_days ?? 0,
      lastActiveAt: profile.last_active_at ?? null,
    },
    activeGoal: active.goal,
    todaySession: sessionRes.data ?? null,
    atlas: {
      weakConcepts,
      recentlyImprovedConcepts: recentlyImproved,
      recentlyPracticedConcepts: concepts.filter((concept: any) => recentlyPracticedIds.has(concept.id)),
      masteredConcepts: mastered,
      conceptAliases: [],
    },
    memory: {
      dueCards: dueCardsRes.data ?? [],
      recentlyReviewedCards: reviewedCardsRes.data ?? [],
      createdToday: createdCardsRes.data ?? [],
    },
    autopsy: {
      recentAssessments: assessmentsRes.data ?? [],
      unresolvedMistakes: mistakes,
      recoverableMistakes: mistakes.filter((mistake: any) => mistake.status !== 'resolved'),
      failedParses: (assessmentsRes.data ?? []).filter((assessment: any) => ['parsing_failed', 'parse_failed'].includes(assessment.status)),
    },
    sources: {
      indexedSources,
      relevantChunks,
      failedSources: (allSources ?? []).filter((source: any) => source.status === 'failed'),
      pendingSources: (allSources ?? []).filter((source: any) => !['ready', 'failed'].includes(source.status)),
    },
    recentLearningEvents: recentEvents,
    recentChatTurns: (chatRes.data ?? []).reverse(),
    guardrails: {
      doNotRepeatConceptIds: Array.from(correctlyAnsweredIds),
      preferredNextConceptIds: weakConcepts.map((concept: any) => concept.id).filter((id: string) => !correctlyAnsweredIds.has(id)).slice(0, 10),
      mustUseSessionObjective: Boolean(sessionRes.data && !(sessionRes.data.is_completed ?? sessionRes.data.isCompleted)),
      sourceGroundingAvailable: relevantChunks.length > 0,
    },
  };
}
