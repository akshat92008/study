import { createAdminClient } from '@/lib/supabase/admin';
import { getSyllabusMastery } from '@/lib/services/atlasService';

export async function syncProfileAggregates(userId: string) {
  const supabase = createAdminClient();

  // 1. Calculate overall mastery
  const mastery = await getSyllabusMastery(userId);
  const overallMastery = mastery?.overallPct || 0;

  // 2. Calculate total mistakes across mock autopsies and practice attempts
  const { count: autopsyMistakes } = await supabase
    .from('mistakes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: practiceMistakes } = await supabase
    .from('practice_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_correct', false);

  const totalMistakes = (autopsyMistakes || 0) + (practiceMistakes || 0);

  // 3. Update the profile
  await supabase
    .from('profiles')
    .update({ 
      overall_mastery: overallMastery,
      total_mistakes: totalMistakes, // If this column exists
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
}
