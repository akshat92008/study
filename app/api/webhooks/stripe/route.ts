import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function POST(request: Request) {
  try {
    // In production, verify Stripe signature using 'stripe.webhooks.constructEvent'
    const body = await request.json();
    const { type, data } = body;
    const supabase = await createClient();

    // 1. Handle Successful Checkout
    if (type === 'checkout.session.completed') {
      const customerId = data.object.customer;
      const userId = data.object.client_reference_id; // Passed when creating Stripe Checkout session
      
      if (userId) {
        await supabase.from('profiles').update({
          stripe_customer_id: customerId,
          subscription_status: 'pro',
        }).eq('id', userId);
        logger.info('User upgraded to Pro', { userId, customerId });
      }
    }

    // 2. Handle Subscription Cancellations
    if (type === 'customer.subscription.deleted') {
      const customerId = data.object.customer;
      await supabase.from('profiles').update({ 
        subscription_status: 'free' 
      }).eq('stripe_customer_id', customerId);
      logger.info('User downgraded to Free', { customerId });
    }

    // 3. Handle Subscription Updates (Renewals/Failures)
    if (type === 'customer.subscription.updated') {
      const customerId = data.object.customer;
      const status = data.object.status; // 'active', 'past_due', 'canceled'
      await supabase.from('profiles').update({ 
        subscription_status: status === 'active' ? 'pro' : 'free' 
      }).eq('stripe_customer_id', customerId);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error('Stripe webhook processing failed:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
  }
}
