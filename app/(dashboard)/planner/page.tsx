export const dynamic = 'force-dynamic';
import { getPlanForDate } from '@/lib/actions/planner';
import PlannerDashboard from '@/components/planner/PlannerDashboard';

export default async function PlannerPage() {
  const today = new Date().toISOString().split('T')[0];
  const tasks = await getPlanForDate(today);
  return <PlannerDashboard initialTasks={tasks || []} date={today} />;
}
