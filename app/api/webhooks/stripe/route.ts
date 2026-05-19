import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

// In a real production app, you would use the 'stripe' npm package to verify the signature.
// Example: const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type;
    const data = body.data.object;

    const supabase = await createClient();

    if (type === 'checkout.session.completed') {
      const customerId = data.customer;
      const userId = data.client_reference_id; // Pass this during checkout
      
      if (userId) {
        await supabase
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            subscription_status: 'pro' // Hardcoding 'pro' for checkout success
          })
          .eq('id', userId);
      }
    }

    if (type === 'customer.subscription.deleted') {
      const customerId = data.customer;
      
      await supabase
        .from('profiles')
        .update({ subscription_status: 'free' })
        .eq('stripe_customer_id', customerId);
    }

    if (type === 'customer.subscription.updated') {
      const customerId = data.customer;
      const status = data.status; // 'active', 'past_due', 'canceled', etc.
      
      await supabase
        .from('profiles')
        .update({ subscription_status: status === 'active' ? 'pro' : 'free' })
        .eq('stripe_customer_id', customerId);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error('Stripe webhook error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
  }
}
