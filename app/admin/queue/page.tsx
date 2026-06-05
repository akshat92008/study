import { Metadata } from 'next';
import QueueDashboard from './QueueDashboard';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';

export const metadata: Metadata = {
  title: 'Admin Queue Recovery | Cognition OS',
  description: 'Manual recovery panel for asynchronous event queues',
};

export default async function AdminQueuePage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin/queue');
  if (auth.status === 403) redirect('/dashboard');
  return <QueueDashboard />;
}
