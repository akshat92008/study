// lib/supabase/adminSafe.ts
// Wraps createAdminClient with user_id assertions so admin queries
// can't accidentally return other users' data.

import { createAdminClient } from '@/lib/supabase/admin';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns an admin Supabase client with a helper that asserts user_id
 * on every query that touches user-scoped tables.
 *
 * Usage:
 *   const { supabase, forUser } = createScopedAdminClient(userId);
 *   const { data } = await forUser(supabase.from('review_logs').select('*'));
 *
 * forUser() adds .eq('user_id', userId) to the query builder.
 */
export function createScopedAdminClient(userId: string) {
  const supabase = createAdminClient();

  function forUser<T extends { eq: (col: string, val: string) => T }>(
    queryBuilder: T
  ): T {
    return queryBuilder.eq('user_id', userId);
  }

  return { supabase, forUser };
}
