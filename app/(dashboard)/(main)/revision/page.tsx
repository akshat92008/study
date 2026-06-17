import { getDueCards, getRevisionStats } from '@/lib/engines/revision-engine';
import { createClient } from '@/lib/supabase/server';
import RevisionDashboard from '@/components/revision/RevisionDashboard';

export default async function RevisionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [cards, stats] = await Promise.all([
    getDueCards(user.id, 75),
    getRevisionStats(user.id),
  ]);

  return <RevisionDashboard data={{ due: cards, stats }} />;
}
