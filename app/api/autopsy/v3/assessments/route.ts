import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { enforceDailyTableCap, jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';

const CreateAssessmentSchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(180),
  assessmentType: z.enum(['mock_test', 'practice_test', 'worksheet', 'assignment', 'quiz', 'past_paper', 'custom']).default('custom'),
  source: z.enum(['manual', 'pdf', 'csv', 'imported']).default('manual'),
  totalMarks: z.number().nonnegative().nullable().optional(),
  scoredMarks: z.number().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  takenAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user, limits } = auth;

    const parsed = CreateAssessmentSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Assessment details are invalid.',
        requestId,
        details: parsed.error.flatten(),
      });
    }

    if (parsed.data.goalId) await ensureGoalForUser(supabase, user.id, parsed.data.goalId);

    const cap = await enforceDailyTableCap({
      supabase,
      userId: user.id,
      table: 'assessments',
      limit: limits.dailyAssessmentsPerUser,
      requestId,
      message: `You can create ${limits.dailyAssessmentsPerUser} Deep Autopsy assessments per day.`,
    });
    if (cap) return cap;

    const { data, error } = await supabase
      .from('assessments')
      .insert({
        user_id: user.id,
        goal_id: parsed.data.goalId ?? null,
        title: parsed.data.title,
        assessment_type: parsed.data.assessmentType,
        source: parsed.data.source,
        total_marks: parsed.data.totalMarks ?? null,
        scored_marks: parsed.data.scoredMarks ?? null,
        duration_minutes: parsed.data.durationMinutes ?? null,
        taken_at: parsed.data.takenAt ?? null,
        status: 'draft',
        extraction_status: parsed.data.source === 'pdf' ? 'uploaded' : 'not_started',
        metadata: parsed.data.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'AUTOPSY_V3_ASSESSMENT_CREATED',
      data: { assessmentId: data.id, goalId: data.goal_id },
      metadata: { source: 'autopsy_v3_assessments', goalId: data.goal_id },
      idempotency_key: `autopsy_v3_assessment_created:${data.id}`,
    }).catch(() => undefined);

    return jsonWithRequestId({ assessment: data }, requestId, 201);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_create_assessment', 'Unable to create Deep Autopsy assessment.');
  }
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));
    const goalId = searchParams.get('goalId');
    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);

    let query = supabase
      .from('assessments')
      .select('*, autopsy_reports(id, status, summary_text, recoverable_marks_estimate, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (goalId) query = query.eq('goal_id', goalId);

    const { data, error } = await query;
    if (error) throw error;
    return jsonWithRequestId({ assessments: data ?? [], pagination: { limit, offset } }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_list_assessments', 'Unable to load Deep Autopsy assessments.');
  }
}
