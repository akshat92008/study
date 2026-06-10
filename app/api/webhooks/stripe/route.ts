import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/billing/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import Stripe from 'stripe';
import { getTierForPriceId } from '@/lib/billing/stripe-plans';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    logger.error('Webhook signature verification failed', { error: err.message });
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;

        if (userId) {
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status; // e.g., active, past_due, canceled
        const priceId = subscription.items.data[0].price.id;

        const tier = status === 'active' || status === 'trialing' ? getTierForPriceId(priceId) : 'free';

        await supabase
          .from('profiles')
          .update({ 
            subscription_status: tier,
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            subscription_provider_status: status,
            subscription_current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            subscription_cancel_at_period_end: (subscription as any).cancel_at_period_end,
            billing_updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await supabase
          .from('profiles')
          .update({ 
            subscription_status: 'free',
            subscription_provider_status: subscription.status,
            billing_updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId);
        break;
      }
      default:
        // Ignore other events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error('Error processing webhook event', { type: event.type, error: err.message });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

