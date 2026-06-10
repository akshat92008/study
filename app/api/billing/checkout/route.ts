import { NextRequest, NextResponse } from 'next/server';
import { getRequestId, apiErrorResponse, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { stripe } from '@/lib/billing/stripe';
import { createClient } from '@/lib/supabase/server';
import { STRIPE_PRICES } from '@/lib/billing/stripe-plans';

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
        message: 'Authentication required for checkout.',
        requestId,
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single();

    const body = await req.json().catch(() => ({}));
    const priceId: string | undefined = body.priceId;

    const validPrices = [
      ...Object.values(STRIPE_PRICES.pro),
      ...Object.values(STRIPE_PRICES.founding),
    ].filter(Boolean);

    if (!priceId || !validPrices.includes(priceId)) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Invalid price ID.',
        requestId,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let customerId: string | undefined = (profile as any)?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        email: (profile as any)?.email || user.email || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/access?checkout=canceled`,
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json(
      { url: session.url },
      { headers: { 'x-request-id': requestId } }
    );
  } catch (error) {
    return unexpectedApiErrorResponse(
      req,
      error,
      'stripe_checkout',
      'Failed to create checkout session.'
    );
  }
}
