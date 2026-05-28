import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia'
});

export async function POST(request: Request) {
  const body = await request.text(); // Must be raw text for signature verification
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET! // Get from Stripe Dashboard → Webhooks
    );
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed', { err: err.message });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const { type, data } = event;
  const supabase = await createClient();

  try {
    // 1. Handle Successful Checkout
    if (type === 'checkout.session.completed') {
      const session = data.object as Stripe.Checkout.Session;
      const customerId = session.customer;
      const userId = session.client_reference_id; // Passed when creating Stripe Checkout session
      
      if (userId) {
        await supabase.from('profiles').update({
          stripe_customer_id: customerId as string,
          subscription_status: 'pro',
        }).eq('id', userId);
        logger.info('User upgraded to Pro', { userId, customerId });
      }
    }

    // 2. Handle Subscription Cancellations
    if (type === 'customer.subscription.deleted') {
      const subscription = data.object as Stripe.Subscription;
      const customerId = subscription.customer;
      await supabase.from('profiles').update({ 
        subscription_status: 'free' 
      }).eq('stripe_customer_id', customerId as string);
      logger.info('User downgraded to Free', { customerId });
    }

    // 3. Handle Subscription Updates (Renewals/Failures)
    if (type === 'customer.subscription.updated') {
      const subscription = data.object as Stripe.Subscription;
      const customerId = subscription.customer;
      const status = subscription.status; // 'active', 'past_due', 'canceled'
      await supabase.from('profiles').update({ 
        subscription_status: status === 'active' ? 'pro' : 'free' 
      }).eq('stripe_customer_id', customerId as string);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error('Stripe webhook processing failed:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
  }
}
