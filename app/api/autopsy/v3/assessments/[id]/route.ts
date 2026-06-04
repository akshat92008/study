import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const PatchAssessmentSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  goalId: z.string().uuid().nullable().optional(),
  totalMarks: z.number().nonnegative().nullable().optional(),
  scoredMarks: z.number().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  takenAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'extracting', 'needs_review', 'answers_pending', 'diagnosis_pending', 'report_generating', 'report_ready', 'failed']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('assessments')
      .select('*, assessment_questions(*), mistake_diagnoses(*), autopsy_reports(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return apiErrorResponse('not_found', { status: 404, message: 'Assessment not found.', requestId });
    }

    return jsonWithRequestId({ assessment: data }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_get_assessment', 'Unable to load Deep Autopsy assessment.');
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;
    const { id } = await context.params;
    const parsed = PatchAssessmentSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Assessment update is invalid.',
        requestId,
        details: parsed.error.flatten(),
      });
    }
    if (parsed.data.goalId) await ensureGoalForUser(supabase, user.id, parsed.data.goalId);

    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.goalId !== undefined) updates.goal_id = parsed.data.goalId;
    if (parsed.data.totalMarks !== undefined) updates.total_marks = parsed.data.totalMarks;
    if (parsed.data.scoredMarks !== undefined) updates.scored_marks = parsed.data.scoredMarks;
    if (parsed.data.durationMinutes !== undefined) updates.duration_minutes = parsed.data.durationMinutes;
    if (parsed.data.takenAt !== undefined) updates.taken_at = parsed.data.takenAt;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.metadata !== undefined) updates.metadata = parsed.data.metadata;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('assessments')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return apiErrorResponse('not_found', { status: 404, message: 'Assessment not found.', requestId });
    }

    return jsonWithRequestId({ assessment: data }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_patch_assessment', 'Unable to update Deep Autopsy assessment.');
  }
}
