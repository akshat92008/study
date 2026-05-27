// lib/utils/billing.ts
// Beta mode: all student features are available without monetization.

export type FeatureLimit = 'tutor_queries_daily' | 'document_uploads' | 'autopsies_monthly';

export async function checkUsageLimit(
  _userId: string,
  _feature: FeatureLimit
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true };
}

export async function getUserSubscriptionStatus(
  _userId: string
): Promise<'free' | 'pro' | 'teams'> {
  return 'free';
}

export async function incrementUsage(
  _userId: string,
  _feature: FeatureLimit
): Promise<void> {
  // No-op in beta
}
