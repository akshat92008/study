import { Metadata } from 'next';
import HermesDashboard from './HermesDashboard';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';

export const metadata: Metadata = {
  title: 'Admin Hermes Cockpit | Cognition OS',
  description: 'Management and replay cockpit for Hermes v1 runtime.',
};

export default async function AdminHermesPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin/hermes');
  if (auth.status === 403) redirect('/dashboard');
  return <HermesDashboard />;
}
