import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

import { UserActionForms } from './UserActionForms';

type SearchParams = Promise<{ q?: string }> | { q?: string };

const profileColumns = 'id,email,full_name,beta_access,beta_access_until,manual_plan,suspended,suspended_reason,created_at';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function findProfiles(q?: string) {
  const supabase = createAdminClient();
  const baseQuery = () =>
    supabase
      .from('profiles')
      .select(profileColumns)
      .order('created_at', { ascending: false })
      .limit(25);

  if (!q) {
    const { data } = await baseQuery();
    return data ?? [];
  }

  const queries = [
    baseQuery().ilike('email', `%${q}%`),
    ...(uuidPattern.test(q) ? [baseQuery().eq('id', q)] : []),
  ];
  const results = await Promise.all(queries);
  const profiles = new Map<string, any>();
  for (const result of results) {
    for (const profile of result.data ?? []) profiles.set(profile.id, profile);
  }
  return Array.from(profiles.values()).slice(0, 25);
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin/users');
  if (auth.status === 403) redirect('/dashboard');

  const params = await searchParams;
  const q = params?.q?.trim();
  const profiles = await findProfiles(q);

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 18px', background: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Beta User Management</h1>
        <p style={{ color: '#526071', marginTop: 8 }}>Search profiles, grant manual access, set plans, and pause accounts.</p>
      </header>

      <form action="/admin/users" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input
          name="q"
          defaultValue={q || ''}
          placeholder="Email or user id"
          style={{ flex: 1, minWidth: 260, border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 12px' }}
        />
        <button type="submit">Search</button>
      </form>

      <div style={{ display: 'grid', gap: 10 }}>
        {profiles.map((profile: any) => (
          <section key={profile.id} style={{ border: '1px solid #d6dce5', borderRadius: 8, background: '#fff', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  <a href={`/admin/users/${profile.id}`} style={{ textDecoration: 'none', color: '#2563eb' }}>
                    {profile.email || profile.full_name || 'Unknown user'}
                  </a>
                </div>
                <code style={{ color: '#526071' }}>{profile.id}</code>
              </div>
              <div style={{ color: '#334155' }}>
                plan: <strong>{profile.manual_plan || 'free'}</strong> · beta: <strong>{profile.beta_access ? 'yes' : 'no'}</strong> · suspended:{' '}
                <strong>{profile.suspended ? 'yes' : 'no'}</strong>
              </div>
            </div>
            <UserActionForms userId={profile.id} />
          </section>
        ))}
      </div>
    </main>
  );
}
