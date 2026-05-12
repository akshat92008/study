'use server';

import { createClient } from '@/lib/supabase/server';
import { getPerformanceData } from '@/lib/engines/performance-engine';

export async function getAnalyticsData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getPerformanceData(user.id);
}
