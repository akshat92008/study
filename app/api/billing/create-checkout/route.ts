import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, subscription_status')
    .eq('id', user.id)
    .single();

  if (profile?.subscription_status === 'pro') {
    return NextResponse.json({ error: 'Already Pro' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: user.id,
    customer_email: user.email,
    line_items: [{
      price: process.env.STRIPE_PRO_PRICE_ID!, // Set this in .env.local
      quantity: 1
    }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=cancelled`,
    metadata: { userId: user.id }
  });

  return NextResponse.json({ url: session.url });
}
