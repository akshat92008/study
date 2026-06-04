import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import {
  completeOnboardingForUser,
  OnboardingCompletionSchema,
  sanitizeSubjectList,
} from '@/lib/services/onboarding.service';

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = OnboardingCompletionSchema.safeParse({
      ...body,
      goalTitle: body.goalTitle ?? body.title ?? body.goal ?? body.goalType,
      goalType: body.goalType ?? body.examType ?? 'Custom Goal',
      targetDate: body.targetDate ?? body.deadline ?? null,
      subjects: sanitizeSubjectList(body.subjects),
    });

    if (!parsed.success) {
      return apiErrorResponse('invalid_onboarding', {
        status: 400,
        message: parsed.error.issues[0]?.message ?? 'Invalid onboarding payload.',
        requestId,
      });
    }

    const result = await completeOnboardingForUser({
      supabase,
      user,
      input: parsed.data,
    });

    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'x-request-id': requestId } }
    );
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'onboarding_complete', 'Unable to complete onboarding.');
  }
}
