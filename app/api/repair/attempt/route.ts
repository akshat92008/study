import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import {
  startRepairSession,
  submitDelayedRetest,
  submitImmediateRepair,
} from '@/lib/services/repair-loop.service';

const BodySchema = z.object({
  action: z.enum(['start', 'immediate', 'delayed']),
  mistakeId: z.string().uuid().optional().nullable(),
  retestId: z.string().uuid().optional().nullable(),
  passed: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Repair attempt payload is invalid.',
        requestId,
        details: parsed.error.flatten(),
      });
    }

    if (parsed.data.action === 'start') {
      if (!parsed.data.mistakeId) {
        return apiErrorResponse('invalid_request', { status: 400, message: 'mistakeId is required.', requestId });
      }
      const mistake = await startRepairSession(supabase, { userId: user.id, mistakeId: parsed.data.mistakeId });
      return NextResponse.json({
        success: true,
        mistake,
        transition: {
          status: 'repairing',
          message: `Repair started: ${mistake.concept || mistake.topic || 'this mistake'}. Pass immediate recall before it can move to delayed retest.`,
        },
      }, { headers: { 'x-request-id': requestId } });
    }

    if (parsed.data.action === 'immediate') {
      if (!parsed.data.mistakeId || typeof parsed.data.passed !== 'boolean') {
        return apiErrorResponse('invalid_request', { status: 400, message: 'mistakeId and passed are required.', requestId });
      }
      const transition = await submitImmediateRepair(supabase, {
        userId: user.id,
        mistakeId: parsed.data.mistakeId,
        passed: parsed.data.passed,
      });
      return NextResponse.json({ success: true, transition }, { headers: { 'x-request-id': requestId } });
    }

    if (typeof parsed.data.passed !== 'boolean') {
      return apiErrorResponse('invalid_request', { status: 400, message: 'passed is required.', requestId });
    }
    if (!parsed.data.retestId && !parsed.data.mistakeId) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'retestId or mistakeId is required.', requestId });
    }

    const transition = await submitDelayedRetest(supabase, {
      userId: user.id,
      mistakeId: parsed.data.mistakeId ?? null,
      retestId: parsed.data.retestId ?? null,
      passed: parsed.data.passed,
    });
    return NextResponse.json({ success: true, transition }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'repair_attempt', 'Unable to save repair progress.');
  }
}
