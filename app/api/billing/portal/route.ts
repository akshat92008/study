import { NextRequest, NextResponse } from 'next/server';
import { getRequestId, apiErrorResponse, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { stripe } from '@/lib/billing/stripe';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication required for billing portal.',
        requestId,
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerId: string | undefined = (profile as any)?.stripe_customer_id;

    if (!customerId) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'No billing account found. Please subscribe to a plan first.',
        requestId,
      });
    }

    const origin = req.nextUrl.origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/access`,
    });

    return NextResponse.json(
      { url: session.url },
      { headers: { 'x-request-id': requestId } }
    );
  } catch (error) {
    return unexpectedApiErrorResponse(
      req,
      error,
      'stripe_portal',
      'Failed to create billing portal session.'
    );
  }
}
