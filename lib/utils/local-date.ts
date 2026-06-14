import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch the user's preferred timezone. Defaults to Asia/Kolkata.
 */
export async function getUserTimezone(userId: string, supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();
  
  // Default to Asia/Kolkata if missing, as it is the primary target demographic
  return data?.timezone || 'Asia/Kolkata';
}

/**
 * Returns the current local date (YYYY-MM-DD) relative to the user's timezone.
 * Replaces hardcoded `new Date().toISOString().split("T")[0]` to prevent
 * timezone boundary bugs at midnight UTC.
 */
export async function getUserLearningDate(userId: string, supabase: SupabaseClient, fromDate?: Date): Promise<string> {
  const timezone = await getUserTimezone(userId, supabase);
  const date = fromDate || new Date();
  
  // 'en-CA' locale reliably formats as YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  return formatter.format(date);
}
