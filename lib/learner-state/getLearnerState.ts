import { createClient } from '@/lib/supabase/server';

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
  } | null;
  currentMission: {
    focusTopic: string | null;
    subject: string | null;
    estimatedMinutes: number | null;
    rationale: string | null;
  } | null;
  atlas: {
    weakConcepts: Array<{ name: string; subject: string; chapter: string; mastery: string }>;
    masterySummary: {
      totalConcepts: number;
      masteredCount: number;
      masteryPercent: number;
    };
  };
  memory: {
    dueCount: number;
    topDueCards: Array<{ id: string; front: string }>;
  };
  autopsy: {
    recentMistakes: Array<{ chapter: string; category: string; mistake_type: string; subject: string; created_at?: string }>;
    needsReviewCount: number;
    lastAutopsy: { test_name: string; current_score: number; potential_score: number; created_at: string } | null;
  };
  recentStudySessions: Array<{ subject?: string | null; chapter?: string | null; durationMinutes?: number | null }>;
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
  recentTopics: string[];
  lastUpdated: string;
}

export async function getLearnerStateSnapshot(
  userId: string,
  options: { topic?: string; subject?: string; client?: SupabaseLike } = {}
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

  let mistakesQuery = supabase
    .from('mistakes')
    .select('chapter, category, mistake_type, subject, created_at')
    .eq('user_id', userId)
    .eq('status', 'verified_mistake')
    .order('created_at', { ascending: false })
    .limit(5);
  if (options.subject) mistakesQuery = mistakesQuery.eq('subject', options.subject);
  if (options.topic) mistakesQuery = mistakesQuery.ilike('chapter', `%${options.topic}%`);

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
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, exam_type, target_date, current_level, learning_style, streak_days, emotional_state, timezone, learner_state_version')
      .eq('id', userId)
      .maybeSingle(),

    weakConceptsQuery,

    mistakesQuery,

    supabase
      .from('revision_cards')
      .select('id, front', { count: 'exact' })
      .eq('user_id', userId)
      .lte('due', now)
      .limit(5),

    supabase
      .from('concepts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),

    supabase
      .from('concepts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('mastery', ['mastered', 'automated', 'proficient']),

    supabase
      .from('study_sessions')
      .select('notes, started_at, subject, chapter, duration_minutes')
      .eq('user_id', userId)
      .not('notes', 'is', null)
      .order('started_at', { ascending: false })
      .limit(5),

    supabase
      .from('learning_goals')
      .select('title, target_date, progress')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),

    supabase
      .from('session_cards')
      .select('"focusTopic", subject, "estimatedMinutes", rationale, learner_state_version')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),

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

    supabase
      .from('autopsy_questions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('evidence_status', ['needs_review', 'pending_review']),

    supabase
      .from('mock_autopsies')
      .select('test_name, current_score, potential_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const profileVersion = Number(profile?.learner_state_version ?? 0);
  const missionVersion = Number(missionRes.data?.learner_state_version ?? -1);
  const currentMission = missionRes.data && missionVersion === profileVersion
    ? missionRes.data
    : null;
  const totalConcepts = totalConceptsRes.count ?? 0;
  const masteredCount = masteredConceptsRes.count ?? 0;
  const sessions = sessionsRes.data ?? [];
  const needsReviewCount = needsReviewCountRes?.count ?? 0;
  const lastAutopsyData = lastAutopsyRes?.data ?? null;

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
    activeGoal: goalRes.data
      ? {
          title: goalRes.data.title,
          targetDate: goalRes.data.target_date ?? null,
          progress: goalRes.data.progress ?? null,
        }
      : null,
    currentMission: currentMission
      ? {
          focusTopic: currentMission.focusTopic,
          subject: currentMission.subject,
          estimatedMinutes: currentMission.estimatedMinutes,
          rationale: currentMission.rationale,
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
    },
    recentStudySessions: sessions.map((session: any) => ({
      subject: session.subject,
      chapter: session.chapter,
      durationMinutes: session.duration_minutes ?? null,
    })),
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
