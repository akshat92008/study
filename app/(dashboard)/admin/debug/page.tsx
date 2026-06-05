import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { requireAdmin } from '@/lib/auth/admin';

export default async function AdminDebugPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin/debug');
  if (auth.status === 403) redirect('/dashboard');

  const supabase = await createClient();
  const user = auth.user;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const { data: events } = await supabase
    .from('event_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: consumers } = await supabase
    .from('consumer_locks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div style={{ padding: 'var(--sp-6)', maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 'var(--sp-5)' }}>
      <header>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, margin: 0 }}>System Debug</h1>
        <p style={{ color: 'var(--text-secondary)' }}>View underlying state for the current session.</p>
      </header>

      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 'var(--sp-3)' }}>Learner Profile</h3>
        <pre style={{ background: 'var(--bg-tertiary)', padding: 'var(--sp-4)', borderRadius: 8, fontSize: '12px', overflowX: 'auto', border: '1px solid var(--border-default)' }}>
          {JSON.stringify(profile, null, 2)}
        </pre>
      </Card>

      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 'var(--sp-3)' }}>Recent Event Queue</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 4px' }}>Time</th>
                <th style={{ padding: '8px 4px' }}>Type</th>
                <th style={{ padding: '8px 4px' }}>Status</th>
                <th style={{ padding: '8px 4px' }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {events?.map((ev) => (
                <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>{new Date(ev.created_at).toLocaleTimeString()}</td>
                  <td style={{ padding: '8px 4px', fontWeight: 'bold' }}>{ev.type}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <Badge color={ev.status === 'HANDLED' ? 'green' : ev.status === 'ERROR' ? 'red' : 'yellow'}>
                      {ev.status}
                    </Badge>
                  </td>
                  <td style={{ padding: '8px 4px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(ev.data)}
                  </td>
                </tr>
              ))}
              {!events?.length && <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No events found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 'var(--sp-3)' }}>Event Consumers</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 4px' }}>Event ID</th>
                <th style={{ padding: '8px 4px' }}>Consumer Name</th>
                <th style={{ padding: '8px 4px' }}>Status</th>
                <th style={{ padding: '8px 4px' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {consumers?.map((c) => (
                <tr key={`${c.event_id}-${c.consumer_name}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>{c.event_id?.slice(0, 8)}...</td>
                  <td style={{ padding: '8px 4px', fontWeight: 'bold' }}>{c.consumer_name}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <Badge color={c.status === 'HANDLED' ? 'green' : c.status === 'ERROR' ? 'red' : 'yellow'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td style={{ padding: '8px 4px' }}>{new Date(c.updated_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {!consumers?.length && <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No consumers found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
