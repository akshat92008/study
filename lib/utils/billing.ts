import { createClient } from '@/lib/supabase/server';

export type FeatureLimit = 'tutor_queries_daily' | 'document_uploads' | 'autopsies_monthly';

const FREE_LIMITS: Record<FeatureLimit, number> = {
  tutor_queries_daily: 10,
  document_uploads: 1,
  autopsies_monthly: 1,
};

export async function checkUsageLimit(userId: string, feature: FeatureLimit): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = await createClient();
  
  // 1. Fetch user subscription status
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single();

  const isPro = profile?.subscription_status === 'pro' || profile?.subscription_status === 'teams';
  if (isPro) return { allowed: true }; // Unlimited for paid tiers

  // 2. Enforce Free Tier Limits
  const limit = FREE_LIMITS[feature];

  if (feature === 'tutor_queries_daily') {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase.from('tutor_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('started_at', `${today}T00:00:00Z`);
    
    if ((count || 0) >= limit) return { allowed: false, reason: `Free tier limit reached (${limit} queries/day). Upgrade to Pro.` };
  }

  if (feature === 'document_uploads') {
    const { count } = await supabase.from('materials')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if ((count || 0) >= limit) return { allowed: false, reason: `Free tier limit reached (${limit} document). Upgrade to Pro for unlimited RAG context.` };
  }

  if (feature === 'autopsies_monthly') {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from('mock_autopsies')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo);
      
    if ((count || 0) >= limit) return { allowed: false, reason: `Free tier limit reached (${limit} autopsy/month). Upgrade to Pro to analyze unlimited mocks.` };
  }

  return { allowed: true };
}
