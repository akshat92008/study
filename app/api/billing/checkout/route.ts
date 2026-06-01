import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function appOrigin(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}

async function createCheckoutSession(req: NextRequest, mode: 'redirect' | 'json') {
  const requestId = getRequestId(req);
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!stripe || !priceId) {
    return apiErrorResponse('billing_not_configured', {
      status: 503,
      message: 'Billing is not configured for this environment.',
      requestId,
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return apiErrorResponse('unauthorized', {
      status: 401,
      message: 'Authentication is required.',
      requestId,
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, subscription_status, email, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.subscription_status === 'pro' || profile?.subscription_status === 'teams') {
    const url = `${appOrigin(req)}/dashboard?billing=active`;
    return mode === 'redirect'
      ? NextResponse.redirect(url, { status: 303 })
      : NextResponse.json({ url, alreadyActive: true }, { headers: { 'x-request-id': requestId } });
  }

  let customerId = profile?.stripe_customer_id || null;
  if (!customerId) {
    const metadataName = user.user_metadata?.full_name;
    const customer = await stripe.customers.create({
      email: user.email || profile?.email || undefined,
      name: profile?.full_name || (typeof metadataName === 'string' ? metadataName : undefined),
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', user.id);
  }

  const origin = appOrigin(req);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?billing=success`,
    cancel_url: `${origin}/dashboard?billing=cancelled`,
    metadata: { userId: user.id },
    subscription_data: {
      metadata: { userId: user.id },
    },
  });

  if (!session.url) {
    logger.error('Stripe checkout did not return a URL', { userId: user.id, requestId });
    return apiErrorResponse('checkout_failed', {
      status: 502,
      message: 'Checkout could not be started. Please try again.',
      requestId,
    });
  }

  return mode === 'redirect'
    ? NextResponse.redirect(session.url, { status: 303 })
    : NextResponse.json({ url: session.url }, { headers: { 'x-request-id': requestId } });
}

export async function GET(req: NextRequest) {
  try {
    return await createCheckoutSession(req, 'redirect');
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'billing-checkout', 'Checkout could not be started.');
  }
}

export async function POST(req: NextRequest) {
  try {
    return await createCheckoutSession(req, 'json');
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'billing-checkout', 'Checkout could not be started.');
  }
}
