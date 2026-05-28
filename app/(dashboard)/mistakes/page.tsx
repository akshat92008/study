import { getMistakeAnalytics } from '@/lib/engines/mistake-engine';
import { createClient } from '@/lib/supabase/server';
import MistakeDashboard from '@/components/mistakes/MistakeDashboard';

export default async function MistakesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const data = await getMistakeAnalytics(user.id);

  return <MistakeDashboard data={data} />;
}
