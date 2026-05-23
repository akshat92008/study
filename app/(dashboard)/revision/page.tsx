import { getDueCards, getRevisionStats } from '@/lib/engines/revision-engine';
import { createClient } from '@/lib/supabase/server';
import RevisionDashboard from '@/components/revision/RevisionDashboard';

export default async function RevisionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('emotional_state')
    .eq('id', user.id)
    .single();

  const [cards, stats] = await Promise.all([
    getDueCards(user.id, 75, profile?.emotional_state ?? 'neutral'),
    getRevisionStats(user.id),
  ]);

  return <RevisionDashboard data={{ due: cards, stats }} />;
}
