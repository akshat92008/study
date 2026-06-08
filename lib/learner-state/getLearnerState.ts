import { createClient } from '@/lib/supabase/server';
import { inferGoalDomain } from '@/lib/goals/goal-domain';
import { getRepairSignals } from '@/lib/services/repair-loop.service';

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

export interface LearnerStateSnapshot {
  profile: {
    userId: string;
    name: string;
    examType: string;
    examDate: string | null;
    currentLevel: string;
    learningStyle: string;
    streakDays: number;
    timezone: string;
    mindStateSignal: string;
    version: number;
  };
  activeGoal: {
    title: string;
    targetDate: string | null;
    progress: number | null;
    subject: string | null;
    domain: string | null;
  } | null;
  currentMission: {
    focusTopic: string | null;
    subject: string | null;
    estimatedMinutes: number | null;
    rationale: string | null;
    isCompleted?: boolean;
  } | null;
  atlas: {
    weakConcepts: Array<{ name: string; subject: string; chapter: string; mastery: string }>;
    masterySummary: {
      totalConcepts: number;
      masteredCount: number;
      masteryPercent: number;
    };
  };
  seededTopics: Array<{ subject: string; chapter: string; topic: string; microtarget: string; order_index: number }>;
  memory: {
    dueCount: number;
    topDueCards: Array<{ id: string; front: string }>;
  };
  autopsy: {
  recentMistakes: Array<{ chapter: string; topic?: string | null; concept?: string | null; category: string; mistake_type: string; subject: string; status?: string | null; mistake_text?: string | null; created_at?: string }>;
    needsReviewCount: number;
    lastAutopsy: { test_name: string; current_score: number; potential_score: number; created_at: string } | null;
    dueRetests: any[];
    openRepairMistakes: any[];
  };
  recentStudySessions: Array<{ subject?: string | null; chapter?: string | null; durationMinutes?: number | null; notes?: string | null; isCompleted?: boolean }>;
  command: {
    openTasks: Array<{ title: string; subject?: string | null; chapter?: string | null; priority?: string | null }>;
  };
  studentModel: {
    learning_style?: string;
    strengths?: string[];
    weaknesses?: string[];
    behavioral_traps?: string[];
    last_updated_at: string;
  } | null;
  hermesMemories?: Array<{
    concept: string;
    pattern: string;
    severity: string;
    action_type: string;
    createdAt?: string;
  }>;
  recentTopics: string[];
  lastUpdated: string;
}

export async function getLearnerStateSnapshot(
  userId: string,
  options: { topic?: string; subject?: string; goalId?: string | null; client?: SupabaseLike } = {}
): Promise<LearnerStateSnapshot> {
  const supabase = options.client ?? (await createClient());
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  let weakConceptsQuery = supabase
    .from('concepts')
    .select('name, subject, chapter, mastery')
    .eq('user_id', userId)
    .in('mastery', ['not_started', 'exposed', 'developing'])
    .order('mastery')
    .limit(5);
  if (options.subject) weakConceptsQuery = weakConceptsQuery.eq('subject', options.subject);
  if (options.topic) weakConceptsQuery = weakConceptsQuery.ilike('chapter', `%${options.topic}%`);
  if (options.goalId) weakConceptsQuery = weakConceptsQuery.eq('goal_id', options.goalId);

  let mistakesQuery = supabase
    .from('mistakes')
    .select('chapter, topic, concept, category, mistake_type, subject, status, mistake_text, created_at')
    .eq('user_id', userId)
    .in('status', ['open', 'repairing', 'retest_due', 'verified_mistake', 'pending_review'])
    .order('created_at', { ascending: false })
    .limit(5);
  if (options.subject) mistakesQuery = mistakesQuery.eq('subject', options.subject);
  if (options.topic) mistakesQuery = mistakesQuery.ilike('chapter', `%${options.topic}%`);
  if (options.goalId) mistakesQuery = mistakesQuery.eq('goal_id', options.goalId);

  let overdueQuery = supabase
    .from('revision_cards')
    .select('id, front', { count: 'exact' })
    .eq('user_id', userId)
    .lte('due', now)
    .limit(5);
  if (options.goalId) overdueQuery = overdueQuery.eq('goal_id', options.goalId);

  let totalConceptsQuery = supabase
    .from('concepts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (options.goalId) totalConceptsQuery = totalConceptsQuery.eq('goal_id', options.goalId);

  let masteredConceptsQuery = supabase
    .from('concepts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('mastery', ['mastered', 'automated', 'proficient']);
  if (options.goalId) masteredConceptsQuery = masteredConceptsQuery.eq('goal_id', options.goalId);

  let sessionsQuery = supabase
    .from('study_sessions')
    .select('notes, started_at, subject, chapter, duration_minutes')
    .eq('user_id', userId)
    .not('notes', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5);
  if (options.goalId) sessionsQuery = sessionsQuery.eq('goal_id', options.goalId);

  let goalQuery = supabase
    .from('learning_goals')
    .select('id, title, target_date, progress, subject, domain')
    .eq('user_id', userId);
  goalQuery = options.goalId
    ? goalQuery.eq('id', options.goalId)
    : goalQuery.eq('status', 'active').limit(1);

  let missionQuery = supabase
    .from('session_cards')
    .select('"focusTopic", subject, "estimatedMinutes", rationale, learner_state_version, is_completed, "isCompleted", completed_at, "completedAt"')
    .eq('user_id', userId)
    .eq('date', today);
  
  if (options.goalId) {
    missionQuery = missionQuery.eq('goal_id', options.goalId);
  } else {
    // If no goalId, prioritize any active mission for today.
    // We don't filter by goal_id is null anymore to avoid fragmentation.
    missionQuery = missionQuery.order('updated_at', { ascending: false }).limit(1);
  }

  let needsReviewCountQuery = supabase
    .from('autopsy_questions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('evidence_status', ['needs_review', 'pending_review']);
  if (options.goalId) needsReviewCountQuery = needsReviewCountQuery.eq('goal_id', options.goalId);

  let lastAutopsyQuery = supabase
    .from('mock_autopsies')
    .select('test_name, current_score, potential_score, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (options.goalId) lastAutopsyQuery = lastAutopsyQuery.eq('goal_id', options.goalId);

  let seededTopicsQuery = supabase
    .from('goal_curriculum_nodes')
    .select('subject, chapter, title, description, order_index, status')
    .eq('user_id', userId)
    .in('status', ['active', 'not_started', 'in_progress'])
    .order('order_index', { ascending: true })
    .limit(10);
  if (options.goalId) seededTopicsQuery = seededTopicsQuery.eq('goal_id', options.goalId);

  const [
    profileRes,
    weakConceptsRes,
    recentMistakesRes,
    overdueRes,
    totalConceptsRes,
    masteredConceptsRes,
    sessionsRes,
    goalRes,
    missionRes,
    taskRes,
    studentModelRes,
    needsReviewCountRes,
    lastAutopsyRes,
    seededTopicsRes,
    hermesMemoriesRes,
    repairSignals,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, exam_type, target_date, current_level, learning_style, streak_days, emotional_state, timezone, learner_state_version')
      .eq('id', userId)
      .maybeSingle(),

    weakConceptsQuery,

    mistakesQuery,

    overdueQuery,

    totalConceptsQuery,

    masteredConceptsQuery,

    supabase
      .from('study_sessions')
      .select('notes, started_at, subject, chapter, duration_minutes, is_completed')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(5),

    goalQuery.maybeSingle(),

    missionQuery.maybeSingle(),

    supabase
      .from('study_tasks')
      .select('title, subject, chapter, priority')
      .eq('user_id', userId)
      .eq('scheduled_date', today)
      .eq('is_completed', false)
      .order('priority', { ascending: false })
      .limit(5),

    supabase
      .from('student_models')
      .select('learning_style, strengths, weaknesses, behavioral_traps, last_updated_at')
      .eq('user_id', userId)
      .order('last_updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    needsReviewCountQuery,

    lastAutopsyQuery.maybeSingle(),

    seededTopicsQuery,

    supabase
      .from('hermes_learning_memories')
      .select('subject, topic, pattern, severity, created_at, next_reminder_condition')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('last_seen_at', { ascending: false })
      .limit(5),

    getRepairSignals(supabase, { userId, goalId: options.goalId, limit: 5 }),
  ]);

  const profile = profileRes.data;
  const profileVersion = Number(profile?.learner_state_version ?? 0);
  
  // Mission hydration: we show the card even if version is old, but we note it.
  // This ensures "next chat after session completion" sees the card (likely completed).
  const missionData = missionRes.data;
  const currentMission = missionData ? {
    focusTopic: missionData.focusTopic,
    subject: missionData.subject,
    estimatedMinutes: missionData.estimatedMinutes,
    rationale: missionData.rationale,
    isCompleted: Boolean(missionData.is_completed || missionData.isCompleted || missionData.completed_at || missionData.completedAt)
  } : null;

  const totalConcepts = totalConceptsRes.count ?? 0;
  const masteredCount = masteredConceptsRes.count ?? 0;
  const sessions = (sessionsRes.data ?? []).map((s: any) => ({
    subject: s.subject,
    chapter: s.chapter,
    durationMinutes: s.duration_minutes,
    notes: s.notes,
    isCompleted: s.is_completed,
    startedAt: s.started_at,
  }));
  const needsReviewCount = needsReviewCountRes?.count ?? 0;
  const lastAutopsyData = lastAutopsyRes?.data ?? null;
  const hermesMemories = (hermesMemoriesRes.data ?? []).map((m: any) => ({
    concept: m.topic || m.subject || 'General',
    pattern: m.pattern,
    severity: m.severity,
    action_type: m.next_reminder_condition || 'Review before next session',
    createdAt: m.created_at,
  }));

  const activeGoalData = goalRes.data;
  let activeGoal: LearnerStateSnapshot['activeGoal'] = null;
  if (activeGoalData) {
    const inferred = inferGoalDomain(activeGoalData.title);
    activeGoal = {
      title: activeGoalData.title,
      targetDate: activeGoalData.target_date ?? null,
      progress: activeGoalData.progress ?? null,
      subject: activeGoalData.subject ?? inferred.subject,
      domain: activeGoalData.domain ?? inferred.domain,
    };
  }

  return {
    profile: {
      userId,
      name: profile?.full_name || 'Student',
      examType: profile?.exam_type || 'General',
      examDate: profile?.target_date || null,
      currentLevel: profile?.current_level || 'intermediate',
      learningStyle: profile?.learning_style || 'visual',
      streakDays: profile?.streak_days || 0,
      timezone: profile?.timezone || 'UTC',
      mindStateSignal: profile?.emotional_state || 'neutral',
      version: profileVersion,
    },
    activeGoal,
    currentMission: currentMission
      ? {
          focusTopic: currentMission.focusTopic,
          subject: currentMission.subject,
          estimatedMinutes: currentMission.estimatedMinutes,
          rationale: currentMission.rationale,
          isCompleted: currentMission.isCompleted,
        }
      : null,
    atlas: {
      weakConcepts: weakConceptsRes.data || [],
      masterySummary: {
        totalConcepts,
        masteredCount,
        masteryPercent: totalConcepts > 0 ? Math.round((masteredCount / totalConcepts) * 100) : 0,
      },
    },
    seededTopics: ((seededTopicsRes.data as any) || []).map((t: any) => ({
      subject: t.subject,
      chapter: t.chapter,
      topic: t.title,
      microtarget: t.description,
      order_index: t.order_index,
      status: t.status,
    })),
    memory: {
      dueCount: overdueRes.count || 0,
      topDueCards: (overdueRes.data || []).map((card: any) => ({ id: card.id, front: card.front })),
    },
    autopsy: {
      recentMistakes: (recentMistakesRes.data as any) || [],
      needsReviewCount,
      lastAutopsy: lastAutopsyData ? {
        test_name: lastAutopsyData.test_name,
        current_score: lastAutopsyData.current_score,
        potential_score: lastAutopsyData.potential_score,
        created_at: lastAutopsyData.created_at,
      } : null,
      dueRetests: repairSignals.dueRetests || [],
      openRepairMistakes: repairSignals.activeMistakes || [],
    },
    recentStudySessions: sessions.map((session: any) => ({
      subject: session.subject,
      chapter: session.chapter,
      durationMinutes: session.durationMinutes ?? null,
      notes: session.notes,
      isCompleted: session.isCompleted,
    })),
    hermesMemories,
    command: {
      openTasks: taskRes.data || [],
    },
    studentModel: studentModelRes.data ?? null,
    recentTopics: sessions
      .map((session: any) => session.chapter || session.notes?.match(/studied\s+(.+?)(?:\s+\(|\.)/i)?.[1])
      .filter(Boolean),
    lastUpdated: now,
  };
}
