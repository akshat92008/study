import type { SupabaseClient } from '@supabase/supabase-js';
import { runHermesTurn } from '@/lib/agent/runtime';

export async function adaptTomorrowSession(input: {
  supabase: SupabaseClient;
  userId: string;
  goalId?: string | null;
}) {
  return runHermesTurn({
    userId: input.userId,
    channel: 'revision',
    userMessage: 'Adapt tomorrow session from recent weak areas.',
    goalId: input.goalId ?? undefined,
  }, {
    supabase: input.supabase,
    idempotencyKey: `background-adapt-tomorrow:${input.userId}:${new Date().toISOString().slice(0, 10)}`,
    finalResponse: 'Tomorrow session adapted.',
    maxToolCalls: 20,
  });
}

