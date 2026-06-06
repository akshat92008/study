import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { upsertMistakeRisk } from '@/lib/services/repair-loop.service';

const ManualMistakeSchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
  subject: z.string().max(120).nullable().optional(),
  topic: z.string().max(160).nullable().optional(),
  chapter: z.string().max(160).nullable().optional(),
  concept: z.string().max(220).nullable().optional(),
  mistakeText: z.string().min(4).max(4000),
  correctAnswer: z.string().max(1000).nullable().optional(),
  whyWrong: z.string().max(1200).nullable().optional(),
  examTrap: z.string().max(1200).nullable().optional(),
  severity: z.number().int().min(1).max(5).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get('goalId');
    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);

    let query = supabase
      .from('mistakes')
      .select('id, source, subject, topic, chapter, concept, mistake_text, correct_answer, why_wrong, exam_trap, severity, status, last_tested_at, next_retest_at, repaired_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (goalId) query = query.eq('goal_id', goalId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ mistakes: data ?? [] }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'mistakes_get', 'Unable to load mistakes.');
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const parsed = ManualMistakeSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Mistake details are invalid.',
        requestId,
        details: parsed.error.flatten(),
      });
    }
    if (parsed.data.goalId) await ensureGoalForUser(supabase, user.id, parsed.data.goalId);

    const repair = await upsertMistakeRisk(supabase, {
      userId: user.id,
      goalId: parsed.data.goalId ?? null,
      source: 'manual',
      subject: parsed.data.subject ?? null,
      topic: parsed.data.topic ?? parsed.data.chapter ?? parsed.data.concept ?? null,
      chapter: parsed.data.chapter ?? parsed.data.topic ?? null,
      concept: parsed.data.concept ?? parsed.data.topic ?? parsed.data.chapter ?? null,
      mistakeText: parsed.data.mistakeText,
      correctAnswer: parsed.data.correctAnswer ?? null,
      whyWrong: parsed.data.whyWrong ?? null,
      examTrap: parsed.data.examTrap ?? null,
      severity: parsed.data.severity ?? 2,
      category: 'conceptual_gap',
      metadata: { entry: 'manual_paste' },
    });

    return NextResponse.json({
      success: true,
      mistake: repair.mistake,
      created: repair.created,
      loopSummary: {
        message: repair.created
          ? `Saved. 1 mistake added: ${repair.mistake.concept}. MEMORY: ${repair.revisionCardCreated ? 1 : 0} card created. Retest: due tomorrow.`
          : `Saved. Existing mistake updated: ${repair.mistake.concept}. Retest remains scheduled.`,
        mistakesCreated: repair.created ? 1 : 0,
        repairCardsCreated: repair.revisionCardCreated ? 1 : 0,
        retestsScheduled: repair.retestScheduled ? 1 : 0,
        tomorrowSessionUpdated: true,
      },
    }, { status: repair.created ? 201 : 200, headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'mistakes_post', 'Unable to save this mistake.');
  }
}
