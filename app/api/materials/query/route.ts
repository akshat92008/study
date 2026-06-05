import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { retrieveRagContext } from '@/lib/rag/retrieval';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { betaAccessErrorResponse, requireActiveBetaUser } from '@/lib/access/beta-access';
import { featureDisabledResponse, isBetaFeatureEnabled } from '@/lib/config/beta-flags';
import { consumeFeatureUsage, enforceFeatureLimit, featureLimitResponse } from '@/lib/usage/enforce-feature-limit';

const QuerySchema = z.object({
  query: z.string().min(2),
  materialIds: z.array(z.string().uuid()).optional(),
  goalId: z.string().uuid().nullable().optional(),
  chatSessionId: z.string().uuid().nullable().optional(),
  subject: z.string().optional(),
  chapter: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    try {
      await requireActiveBetaUser(user.id);
    } catch (accessError) {
      return betaAccessErrorResponse(accessError, requestId) ?? apiErrorResponse('beta_access_required', {
        status: 403,
        message: 'Cognition OS is currently in a limited beta. Ask the admin to activate your beta access.',
        requestId,
      });
    }
    if (!isBetaFeatureEnabled('rag_query')) return featureDisabledResponse(requestId);
    try {
      await enforceFeatureLimit(user.id, 'material_query');
    } catch (limitError: any) {
      if (limitError?.check) return featureLimitResponse(limitError.check, requestId);
      throw limitError;
    }

    const parsed = QuerySchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Invalid material query payload.', requestId });
    }
    if (parsed.data.goalId) {
      await ensureGoalForUser(supabase, user.id, parsed.data.goalId);
    }

    let processingWarning = false;
    if (parsed.data.materialIds && parsed.data.materialIds.length > 0) {
      const { data: mats } = await supabase
        .from('study_materials')
        .select('id, status')
        .in('id', parsed.data.materialIds)
        .eq('user_id', user.id);
      if (mats && mats.some(m => m.status !== 'ready')) {
        processingWarning = true;
      }
    }

    const context = await retrieveRagContext({
      userId: user.id,
      query: parsed.data.query,
      materialIds: parsed.data.materialIds,
      goalId: parsed.data.goalId,
      chatSessionId: parsed.data.chatSessionId,
      subject: parsed.data.subject,
      chapter: parsed.data.chapter,
      mode: 'explicit',
    });

    if (processingWarning) {
      context.warnings.push('Some of the requested study materials are still processing and their content may not be fully available yet.');
    }

    const usage = await consumeFeatureUsage(user.id, 'material_query', 1, {
      idempotencyKey: `material_query:${user.id}:${requestId}`,
      materialIds: parsed.data.materialIds ?? [],
    });
    if (!usage.allowed) return featureLimitResponse(usage, requestId);

    return NextResponse.json({ rag: context }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'materials_query_unhandled', 'Unable to query study materials.');
  }
}
