import { ensureGoalForUser, GOAL_SELECT } from '@/lib/services/goal-context.service';
import { toHermesSourceStatus } from '@/lib/services/source-status.service';
import type { HermesUserState } from './types';

function emptyState(userId: string, warnings: string[] = []): HermesUserState {
  return {
    userId,
    activeGoal: null,
    counts: {
      sourcesReady: 0,
      sourcesProcessing: 0,
      sourcesFailed: 0,
      dueCards: 0,
      weakConcepts: 0,
      recentMistakes: 0,
      pendingMicrotasks: 0,
    },
    todayTasks: [],
    sourceStatuses: [],
    warnings,
  };
}

async function safeQuery<T>(promise: PromiseLike<{ data?: T; count?: number | null; error?: any }>, warnings: string[], label: string) {
  const result = await promise;
  if (result.error) {
    warnings.push(label);
    return { data: undefined as T | undefined, count: 0 };
  }
  return { data: result.data, count: result.count ?? 0 };
}

async function resolveActiveGoal(supabase: any, userId: string, goalId?: string | null) {
  if (goalId) return ensureGoalForUser(supabase, userId, goalId);
  const { data, error } = await supabase
    .from('learning_goals')
    .select(GOAL_SELECT)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Unable to load active goal.');
  return data ?? null;
}

export async function getHermesUserState(
  supabase: any,
  userId: string,
  goalId?: string | null
): Promise<HermesUserState> {
  const warnings: string[] = [];
  const activeGoal = await resolveActiveGoal(supabase, userId, goalId);
  if (!activeGoal) return emptyState(userId, ['no_active_goal']);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [
    todayTasks,
    latestSessionCard,
    sourceStatuses,
    sourcesReady,
    sourcesProcessing,
    sourcesFailed,
    dueCards,
    weakConcepts,
    recentMistakes,
    latestAutopsy,
    topMemory,
    profileSummary,
  ] = await Promise.all([
    safeQuery<any[]>(
      supabase
        .from('daily_microtasks')
        .select('id, title, subject, topic, estimated_minutes, priority, status, type')
        .eq('user_id', userId)
        .eq('goal_id', activeGoal.id)
        .eq('task_date', today)
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(5),
      warnings,
      'today_tasks_unavailable'
    ),
    safeQuery<any>(
      supabase
        .from('session_cards')
        .select('id, focusTopic, subject, estimatedMinutes, rationale, priority, created_at')
        .eq('user_id', userId)
        .eq('goal_id', activeGoal.id)
        .eq('date', today)
        .maybeSingle(),
      warnings,
      'session_card_unavailable'
    ),
    safeQuery<any[]>(
      supabase
        .from('study_materials')
        .select('id, title, original_filename, status, retry_count, last_error, error_message, chunk_count, embedding_count, queued_at, processing_started_at, embedding_started_at, updated_at, created_at')
        .eq('user_id', userId)
        .eq('goal_id', activeGoal.id)
        .order('created_at', { ascending: false })
        .limit(10),
      warnings,
      'source_status_unavailable'
    ),
    safeQuery<any[]>(supabase.from('study_materials').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', activeGoal.id).eq('status', 'ready'), warnings, 'source_ready_count_unavailable'),
    safeQuery<any[]>(supabase.from('study_materials').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', activeGoal.id).in('status', ['uploaded', 'queued', 'processing', 'parsed', 'embedding']), warnings, 'source_processing_count_unavailable'),
    safeQuery<any[]>(supabase.from('study_materials').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', activeGoal.id).in('status', ['failed', 'needs_user_action']), warnings, 'source_failed_count_unavailable'),
    safeQuery<any[]>(supabase.from('revision_cards').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', activeGoal.id).lte('due', now).neq('state', 4), warnings, 'due_cards_count_unavailable'),
    safeQuery<any[]>(supabase.from('concepts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', activeGoal.id).in('mastery', ['not_started', 'exposed', 'developing']), warnings, 'weak_concepts_count_unavailable'),
    safeQuery<any[]>(supabase.from('mistakes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', activeGoal.id).gte('created_at', fourteenDaysAgo), warnings, 'recent_mistakes_count_unavailable'),
    safeQuery<any>(
      supabase
        .from('autopsy_reports')
        .select('id, summary_text, recoverable_marks_estimate, top_patterns, top_topics, created_at')
        .eq('user_id', userId)
        .eq('goal_id', activeGoal.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      warnings,
      'autopsy_summary_unavailable'
    ),
    safeQuery<any>(
      supabase
        .from('hermes_learning_memories')
        .select('id, memory_type, subject, topic, pattern, evidence_count, severity, confidence, prevention_rule, last_seen_at')
        .eq('user_id', userId)
        .eq('goal_id', activeGoal.id)
        .eq('status', 'active')
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      warnings,
      'memory_unavailable'
    ),
    safeQuery<any>(
      supabase
        .from('profiles')
        .select('id, full_name, exam_type, target_date, timezone, overall_mastery, learner_state_version')
        .eq('id', userId)
        .maybeSingle(),
      warnings,
      'profile_summary_unavailable'
    ),
  ]);

  const tasks = (todayTasks.data ?? []).map((task: any) => ({
    id: task.id,
    title: task.title,
    subject: task.subject ?? null,
    topic: task.topic ?? null,
    estimatedMinutes: task.estimated_minutes ?? null,
    priority: task.priority ?? null,
    status: task.status ?? null,
    type: task.type ?? null,
  }));

  return {
    userId,
    activeGoal: {
      id: activeGoal.id,
      title: activeGoal.title,
      subject: activeGoal.subject ?? null,
      domain: activeGoal.domain ?? null,
      exam_type: activeGoal.exam_type ?? null,
      progress: activeGoal.progress ?? null,
      metadata: activeGoal.metadata ?? null,
    },
    counts: {
      sourcesReady: sourcesReady.count,
      sourcesProcessing: sourcesProcessing.count,
      sourcesFailed: sourcesFailed.count,
      dueCards: dueCards.count,
      weakConcepts: weakConcepts.count,
      recentMistakes: recentMistakes.count,
      pendingMicrotasks: tasks.length,
    },
    todayTasks: tasks,
    sourceStatuses: (sourceStatuses.data ?? []).map(toHermesSourceStatus),
    latestAutopsy: latestAutopsy.data ?? null,
    latestSessionCard: latestSessionCard.data ?? null,
    nextAction: topMemory.data ?? null,
    profileSummary: profileSummary.data ?? null,
    warnings,
  };
}
