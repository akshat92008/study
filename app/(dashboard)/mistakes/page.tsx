import { createClient } from '@/lib/supabase/server';
import MistakeDashboard from '@/components/mistakes/MistakeDashboard';

export default async function MistakesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: mistakes } = await supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return <MistakeDashboard mistakes={mistakes ?? []} />;
}
