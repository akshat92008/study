import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function subscriptionStatus(status?: string | null): 'free' | 'pro' {
  return status === 'active' || status === 'trialing' ? 'pro' : 'free';
}

async function updateProfileByCustomer(customerId: string, patch: Record<string, any>) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('stripe_customer_id', customerId);

  if (error) {
    logger.error('Stripe webhook profile update failed', { customerId, error: error.message });
  }
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    logger.warn('Invalid Stripe webhook signature', { error: error?.message });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

      if (userId && customerId) {
        const supabase = createAdminClient();
        await supabase
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId ?? null,
            subscription_status: 'pro',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

      if (customerId) {
        await updateProfileByCustomer(customerId, {
          stripe_subscription_id: subscription.id,
          subscription_status: event.type === 'customer.subscription.deleted'
            ? 'free'
            : subscriptionStatus(subscription.status),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('Stripe webhook handling failed', { type: event.type, error: error?.message });
    return NextResponse.json({ error: 'webhook_handler_failed' }, { status: 500 });
  }
}
