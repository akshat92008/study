import type { SubscriptionTier } from './tiers';

export const STRIPE_PRICES = {
  pro: {
    monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY || '',
    yearly: process.env.STRIPE_PRICE_ID_PRO_YEARLY || '',
  },
  founding: {
    lifetime: process.env.STRIPE_PRICE_ID_FOUNDING || '',
  },
};

export function getTierForPriceId(priceId: string): SubscriptionTier {
  if (priceId === STRIPE_PRICES.pro.monthly || priceId === STRIPE_PRICES.pro.yearly) {
    return 'pro';
  }
  if (priceId === STRIPE_PRICES.founding.lifetime) {
    return 'founding';
  }
  return 'free'; // default
}
