import type { SupabaseClient } from '@supabase/supabase-js';

export function taskTypeForLearningEvent(eventType: string) {
  switch (eventType) {
    case 'source_used':
    case 'explanation_generated':
    case 'weak_area_detected':
    case 'misconception_detected':
      return 'concept';
    case 'practice_attempt_submitted':
    case 'practice_needed':
      return 'practice';
    case 'revision_card_created':
    case 'revision_needed':
    case 'revision_reviewed':
      return 'revision';
    case 'session_completed':
      return 'custom';
    default:
      return null;
  }
}

export async function updateOrCreateMicrotarget(
  supabase: SupabaseClient,
  input: {
    userId: string;
    goalId?: string | null;
    eventType: string;
    conceptId?: string | null;
    concept?: string | null;
    subject?: string | null;
    topic?: string | null;
    now?: Date;
  }
) {
  const type = taskTypeForLearningEvent(input.eventType);
  if (!type) return { changed: false, ids: [] as string[], created: false };

  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  let query = supabase
    .from('daily_microtasks')
    .select('id')
    .eq('user_id', input.userId)
    .eq('task_date', today)
    .eq('type', type)
    .eq('status', 'pending')
    .limit(1);
  if (input.goalId) query = query.eq('goal_id', input.goalId);

  const { data: existing, error: readError } = await query.maybeSingle();
  if (readError) throw readError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('daily_microtasks')
      .update({ status: 'done', completed_at: (input.now ?? new Date()).toISOString() })
      .eq('id', existing.id)
      .eq('user_id', input.userId)
      .select('id')
      .single();
    if (error) throw error;
    return { changed: true, ids: data?.id ? [data.id] : [], created: false };
  }

  if (!['weak_area_detected', 'misconception_detected', 'practice_needed', 'revision_needed'].includes(input.eventType)) {
    return { changed: false, ids: [] as string[], created: false };
  }

  const { data, error } = await supabase
    .from('daily_microtasks')
    .insert({
      user_id: input.userId,
      goal_id: input.goalId ?? null,
      task_date: today,
      title: input.concept ? `Repair ${input.concept}` : 'Repair weak area',
      subject: input.subject ?? null,
      topic: input.topic ?? input.concept ?? null,
      concept_id: input.conceptId ?? null,
      type,
      estimated_minutes: type === 'practice' ? 20 : 15,
      status: 'pending',
      priority: input.eventType === 'misconception_detected' ? 'high' : 'medium',
      source: 'mind',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { changed: true, ids: data?.id ? [data.id] : [], created: true };
}

