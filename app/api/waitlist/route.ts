import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

const WaitlistSchema = z.object({
  email: z.string().trim().email().max(160),
  goalType: z.string().trim().max(80).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = WaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return apiErrorResponse('invalid_waitlist_request', {
        status: 400,
        message: 'A valid email is required.',
        requestId,
      });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('beta_waitlist')
      .upsert({
        email: parsed.data.email.toLowerCase(),
        goal_type: parsed.data.goalType || null,
        status: 'waiting',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

    if (error) throw error;

    return NextResponse.json(
      { success: true, message: 'You are on the waitlist.' },
      { status: 202, headers: { 'x-request-id': requestId } }
    );
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'waitlist_signup', 'Unable to join the waitlist.');
  }
}
