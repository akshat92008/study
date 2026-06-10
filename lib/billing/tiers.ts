export type SubscriptionTier = 'free' | 'founding' | 'pro' | 'admin' | 'unlimited';

export function normalizeSubscriptionTier(value: unknown): SubscriptionTier {
  const plan = String(value || 'free').toLowerCase();
  if (plan === 'founding' || plan === 'pro' || plan === 'admin' || plan === 'unlimited') return plan;
  return 'free';
}
