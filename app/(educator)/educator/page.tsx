import { createClient } from '@/lib/supabase/server';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default async function EducatorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get the institute for this educator
  const { data: membership } = await supabase
    .from('institute_memberships')
    .select('institute_id')
    .eq('user_id', user!.id)
    .single();

  const instituteId = membership?.institute_id;

  // Get all students in this institute
  const { data: students } = await supabase
    .from('institute_memberships')
    .select('user_id, profiles(full_name, emotional_state, current_score)')
    .eq('institute_id', instituteId)
    .eq('role', 'student');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'bold' }}>Cohort Overview</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-4)' }}>
        <Card title="Total Students" style={{ padding: 'var(--sp-4)' }}>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'bold' }}>{students?.length || 0}</div>
        </Card>
        
        <Card title="Burnout Alerts" style={{ padding: 'var(--sp-4)' }}>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'bold', color: 'var(--danger)' }}>
            {students?.filter(s => (s.profiles as any)?.emotional_state === 'burnt_out').length || 0}
          </div>
        </Card>
      </div>

      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'bold', marginTop: 'var(--sp-4)' }}>Student Roster</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {students?.map(s => {
          const profile = s.profiles as any;
          return (
            <Card key={s.user_id} style={{ padding: 'var(--sp-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{profile?.full_name || 'Unknown Student'}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Score: {profile?.current_score || 0}</div>
              </div>
              <Badge color={profile?.emotional_state === 'burnt_out' ? 'red' : 'green'}>
                {profile?.emotional_state || 'neutral'}
              </Badge>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
