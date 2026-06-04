import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ingestLearningSignal } from '@/lib/learning-signals/ingest';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';

const BodySchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
  subject: z.string().max(120).nullable().optional(),
  topic: z.string().max(160).nullable().optional(),
  reflection: z.string().min(4).max(1200),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user, limits } = auth;
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Reflection is invalid.', requestId });
    }

    const signal = await ingestLearningSignal(supabase, {
      user_id: user.id,
      goal_id: parsed.data.goalId ?? null,
      signal_type: 'self_reflection',
      source_type: 'autopsy_v3_reflection',
      subject: parsed.data.subject ?? null,
      topic: parsed.data.topic ?? null,
      confidence: 0.55,
      evidence: { reflection: parsed.data.reflection },
    }, { publishEvent: true });

    let memory: any = null;
    if (limits.hermesEnabled) {
      const { data } = await supabase
        .from('hermes_learning_memories')
        .insert({
          user_id: user.id,
          goal_id: parsed.data.goalId ?? null,
          memory_type: 'self_reported_weakness',
          subject: parsed.data.subject ?? null,
          topic: parsed.data.topic ?? null,
          pattern: parsed.data.reflection.slice(0, 500),
          evidence_count: 1,
          severity: 'medium',
          confidence: 0.55,
          next_reminder_condition: parsed.data.topic ? `Before practicing ${parsed.data.topic}` : 'Before the next study session',
          source_refs: [{ source_type: 'self_reflection', at: new Date().toISOString() }],
          status: 'active',
        })
        .select('*')
        .single();
      memory = data ?? null;
    }

    return jsonWithRequestId({ signal, memory }, requestId, 201);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_reflection', 'Unable to save this reflection.');
  }
}
