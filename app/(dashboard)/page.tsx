import { createClient } from '@/lib/supabase/server';
import { getCognitionData } from '@/lib/actions/cognition';
import { getRevisionData } from '@/lib/actions/revision';
import { getMistakeData } from '@/lib/actions/mistakes';
import { getPlanForDate } from '@/lib/actions/planner';
import CommandCenter from '@/components/dashboard/CommandCenter';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const today = new Date().toISOString().split('T')[0];

  const [cognition, revision, mistakes, tasks] = await Promise.all([
    getCognitionData(),
    getRevisionData(),
    getMistakeData(),
    getPlanForDate(today),
  ]);

  return (
    <CommandCenter
      profile={profile}
      cognition={cognition}
      revision={revision}
      mistakes={mistakes}
      tasks={tasks || []}
    />
  );
}
