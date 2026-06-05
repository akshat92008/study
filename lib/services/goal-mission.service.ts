import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { DailyMicrotaskService, type DailyMicrotask } from '@/lib/services/daily-microtask.service';
import { seedTopicsForGoal } from '@/lib/topic-seeding';
import { inferGoalDomain } from '@/lib/goals/goal-domain';

export type GoalMissionResult = {
  tasks: DailyMicrotask[];
  created: boolean;
  reason: string;
};

function toMissionTask(row: any, goal: any, date: string, index: number): Omit<DailyMicrotask, 'id' | 'created_at' | 'completed_at'> {
  return {
    user_id: goal.user_id,
    goal_id: goal.id,
    session_card_id: null,
    task_date: date,
    title: row.microtarget ?? row.title ?? `Study ${row.topic ?? goal.title}`,
    subject: row.subject ?? goal.subject ?? null,
    topic: row.topic ?? row.chapter ?? goal.title,
    concept_id: row.concept_id ?? null,
    type: row.type ?? 'concept',
    estimated_minutes: row.estimated_minutes ?? 20,
    target_count: null,
    status: 'pending',
    priority: index === 0 ? 'high' : 'medium',
    source: row.source ?? 'amaura_mission',
  };
}

function fallbackTopics(goal: any) {
  const domain = inferGoalDomain(goal.title ?? 'Learning goal', {
    subject: goal.subject,
    domain: goal.domain,
    exam: goal.exam_type,
    grade: goal.target_level,
  });
  const subject = domain.subject ?? goal.subject ?? 'General';
  const focus = goal.title ?? subject;
  return [
    {
      title: `Map the scope for ${focus}`,
      topic: focus,
      subject,
      estimated_minutes: 15,
      type: 'concept',
      source: 'amaura_mission_fallback',
    },
    {
      title: `Learn the first core idea in ${focus}`,
      topic: focus,
      subject,
      estimated_minutes: 25,
      type: 'concept',
      source: 'amaura_mission_fallback',
    },
    {
      title: `Practice 5 recall questions for ${focus}`,
      topic: focus,
      subject,
      estimated_minutes: 20,
      type: 'practice',
      source: 'amaura_mission_fallback',
    },
  ];
}

async function loadSeededTopics(supabase: any, userId: string, goalId: string) {
  const { data, error } = await supabase
    .from('seeded_topics')
    .select('id, subject, chapter, topic, microtarget, status, order_index, source')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .in('status', ['active', 'not_started', 'in_progress'])
    .order('order_index', { ascending: true })
    .limit(5);

  if (error) throw new Error('Unable to load roadmap topics.');
  return data ?? [];
}

export async function getOrCreateGoalMission(
  supabase: any,
  userId: string,
  goalId: string,
  date: string
): Promise<GoalMissionResult> {
  const goal = await ensureGoalForUser(supabase, userId, goalId);
  const service = new DailyMicrotaskService(supabase);
  const existing = await service.getMicrotasksForDate(userId, date, goalId);
  if (existing.length > 0) {
    return { tasks: existing, created: false, reason: 'existing_mission' };
  }

  let seededTopics = await loadSeededTopics(supabase, userId, goalId);
  if (seededTopics.length === 0) {
    const domain = inferGoalDomain(goal.title, {
      subject: goal.subject,
      domain: goal.domain,
      exam: goal.exam_type,
      grade: goal.target_level,
    });
    await seedTopicsForGoal(supabase, {
      userId,
      goalId,
      goalTitle: goal.title,
      goalType: domain.exam ?? domain.domain,
      subject: domain.subject ?? goal.subject ?? null,
      subjects: domain.subject ? [domain.subject] : goal.subject ? [goal.subject] : [],
      domain: domain.domain,
      exam: domain.exam,
      grade: domain.grade,
      board: domain.board,
    }).catch(() => null);
    seededTopics = await loadSeededTopics(supabase, userId, goalId);
  }

  const sourceRows = seededTopics.length > 0 ? seededTopics : fallbackTopics(goal);
  const rows = sourceRows.slice(0, 5).map((row: any, index: number) => toMissionTask(row, goal, date, index));
  const created = await service.replaceMicrotasks(userId, date, rows, goalId);
  return {
    tasks: created,
    created: true,
    reason: seededTopics.length > 0 ? 'seeded_topics' : 'goal_aware_fallback',
  };
}
