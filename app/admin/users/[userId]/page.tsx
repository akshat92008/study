import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { UserActionForms } from '../UserActionForms';

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin/users');
  if (auth.status === 403) redirect('/dashboard');

  const { userId } = await params;
  const supabase = createAdminClient();

  const [
    { data: profile },
    { count: sessionCount },
    { count: goalCount },
    { count: chatCount },
    { count: autopsyCount },
    { count: dueCardCount },
    { data: recentSessions }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('study_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('learning_goals').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('chat_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('revision_cards').select('*', { count: 'exact', head: true }).eq('user_id', userId).lte('due', new Date().toISOString()),
    supabase.from('study_sessions').select('id, created_at, status, streak_days').eq('user_id', userId).order('created_at', { ascending: false }).limit(5)
  ]);

  if (!profile) {
    return (
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 18px' }}>
        <h1>User not found</h1>
        <p>ID: {userId}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 18px', background: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>{profile.full_name || profile.email || 'Unknown User'}</h1>
        <code style={{ color: '#526071' }}>{profile.id}</code>
      </header>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
        <div style={{ padding: 16, background: 'white', borderRadius: 8, border: '1px solid #d6dce5' }}>
          <h3>Profile & Plan</h3>
          <ul>
            <li>Email: {profile.email}</li>
            <li>Plan: <strong>{profile.subscription_status}</strong> (manual: {profile.manual_plan})</li>
            <li>Suspended: {profile.suspended ? `Yes (${profile.suspended_reason})` : 'No'}</li>
            <li>Beta Access: {profile.beta_access ? 'Yes' : 'No'}</li>
            <li>Onboarding: {profile.onboarding_completed ? 'Completed' : 'Pending'}</li>
            <li>Created: {new Date(profile.created_at).toLocaleString()}</li>
            <li>Last Active: {profile.last_active_at ? new Date(profile.last_active_at).toLocaleString() : 'N/A'}</li>
          </ul>
        </div>
        
        <div style={{ padding: 16, background: 'white', borderRadius: 8, border: '1px solid #d6dce5' }}>
          <h3>Usage & Content</h3>
          <ul>
            <li>Goals: {goalCount || 0}</li>
            <li>Chat Sessions: {chatCount || 0}</li>
            <li>Study Sessions: {sessionCount || 0}</li>
            <li>Autopsy Reports: {autopsyCount || 0}</li>
            <li>Due Cards: {dueCardCount || 0}</li>
          </ul>
        </div>
      </section>

      <section style={{ padding: 16, background: 'white', borderRadius: 8, border: '1px solid #d6dce5', marginBottom: 24 }}>
        <h3>Actions</h3>
        <UserActionForms userId={userId} />
      </section>

      <section style={{ padding: 16, background: 'white', borderRadius: 8, border: '1px solid #d6dce5' }}>
        <h3>Recent Sessions</h3>
        {recentSessions?.length ? (
          <ul>
            {recentSessions.map((s: any) => (
              <li key={s.id}>
                {new Date(s.created_at).toLocaleDateString()} - Status: {s.status} - Streak: {s.streak_days}
              </li>
            ))}
          </ul>
        ) : (
          <p>No recent sessions.</p>
        )}
      </section>
    </main>
  );
}
