import type { SupabaseClient } from '@supabase/supabase-js';

export async function consolidateMemory(input: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data } = await input.supabase
    .from('revision_cards')
    .select('id, normalized_key, created_at')
    .eq('user_id', input.userId)
    .not('normalized_key', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const seen = new Set<string>();
  const duplicates = (data ?? []).filter((card: any) => {
    if (!card.normalized_key) return false;
    if (seen.has(card.normalized_key)) return true;
    seen.add(card.normalized_key);
    return false;
  });

  if (duplicates.length > 0) {
    await input.supabase
      .from('revision_cards')
      .update({ state: 4 })
      .in('id', duplicates.map((card: any) => card.id))
      .eq('user_id', input.userId);
  }

  return { duplicatesBuried: duplicates.length };
}

