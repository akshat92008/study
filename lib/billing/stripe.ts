import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-05-27.dahlia',
  appInfo: {
    name: 'Cognition OS',
    version: '0.1.0',
  },
});
