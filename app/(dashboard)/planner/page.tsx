import { createClient } from '@/lib/supabase/server';
import PlannerDashboard from '@/components/planner/PlannerDashboard';

export default async function PlannerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];

  const { data: tasks } = await supabase
    .from('study_tasks')
    .select('*')
    .eq('user_id', user.id)
    .gte('scheduled_date', today)
    .order('priority', { ascending: false })
    .limit(50);

  return <PlannerDashboard initialTasks={tasks ?? []} date={today} />;
}
