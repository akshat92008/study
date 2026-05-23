import { createClient } from '@/lib/supabase/server';
import PlannerDashboard from '@/components/planner/PlannerDashboard';

export default async function PlannerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tasks } = await supabase
    .from('study_tasks')
    .select('*')
    .eq('user_id', user.id)
    .gte('scheduled_date', new Date().toISOString().split('T')[0])
    .order('priority', { ascending: false })
    .limit(50);

  const { data: profile } = await supabase
    .from('profiles')
    .select('exam_date, exam_type, study_hours_per_day')
    .eq('id', user.id)
    .single();

  return <PlannerDashboard initialTasks={tasks ?? []} profile={profile} />;
}
