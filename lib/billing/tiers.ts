export type SubscriptionTier = 'free' | 'founding' | 'pro' | 'admin';

export function normalizeSubscriptionTier(value: unknown): SubscriptionTier {
  const plan = String(value || 'free').toLowerCase();
  if (plan === 'founding' || plan === 'pro' || plan === 'admin') return plan;
  return 'free';
}
