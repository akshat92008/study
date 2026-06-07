import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ingestLearningSignal } from '@/lib/learning-signals/ingest';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';
import { writePatternMemoryForUser } from '@/lib/amaura/agents/repositories';
import { runCognitionAgentTurn } from '@/lib/agent/runtime';
import { logger } from '@/lib/utils/logger';

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
    const { supabase, user } = auth;
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

    const memory = await writePatternMemoryForUser(user.id, {
      goalId: parsed.data.goalId ?? null,
      subject: parsed.data.subject ?? null,
      topic: parsed.data.topic ?? null,
      patternType: 'self_reported_weakness',
      pattern: parsed.data.reflection.slice(0, 500),
      severity: 'medium',
      confidence: 0.55,
      weight: 0.55,
      evidence: { signalType: signal.signal_type, sourceType: signal.source_type },
      sourceRefs: [{ source_type: 'self_reflection', at: new Date().toISOString() }],
    });

    // Phase 7: Wire reflection through agent runtime for ATLAS/MEMORY mutations
    let agentLoopResult: any = null;
    try {
      agentLoopResult = await runCognitionAgentTurn({
        userId: user.id,
        channel: 'autopsy',
        goalId: parsed.data.goalId ?? undefined,
        payload: {
          reflection: parsed.data.reflection,
          subject: parsed.data.subject,
          topic: parsed.data.topic,
          memoryId: memory?.id,
          source: 'autopsy_v3_reflection',
        },
        sessionId: undefined,
      }, { supabase: supabase as any });

      logger.info('Reflection agent runtime completed', {
        userId: user.id,
        changed: agentLoopResult?.mutationSummary?.changed,
      });
    } catch (runtimeError) {
      logger.warn('Reflection agent runtime failed (non-fatal)', {
        userId: user.id,
        error: runtimeError instanceof Error ? runtimeError.message : String(runtimeError),
      });
    }

    return jsonWithRequestId({ signal, memory, agentMutationSummary: agentLoopResult?.mutationSummary ?? null }, requestId, 201);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_reflection', 'Unable to save this reflection.');
  }
}
