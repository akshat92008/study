import type { SupabaseClient } from '@supabase/supabase-js';

export function normalizeMemoryKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export async function findRecentMemoryCard(
  supabase: SupabaseClient,
  input: { userId: string; normalizedKey: string; sinceIso: string }
) {
  const { data, error } = await supabase
    .from('revision_cards')
    .select('id')
    .eq('user_id', input.userId)
    .eq('normalized_key', input.normalizedKey)
    .gte('created_at', input.sinceIso)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

