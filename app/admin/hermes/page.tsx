import { Metadata } from 'next';
import HermesDashboard from './HermesDashboard';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';

export const metadata: Metadata = {
  title: 'Admin Amaura Runtime | Cognition OS',
  description: 'Management and replay cockpit for Amaura Runtime.',
};

export default async function AdminHermesPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin/hermes');
  if (auth.status === 403) redirect('/dashboard');
  return <HermesDashboard />;
}
