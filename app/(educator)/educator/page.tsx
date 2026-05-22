import { createClient } from '@/lib/supabase/server';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { redirect } from 'next/navigation';

export default async function EducatorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get the educator's institute
  const { data: membership } = await supabase
    .from('institute_memberships')
    .select('institute_id, institutes(name)')
    .eq('user_id', user.id)
    .eq('role', 'educator')
    .single();

  if (!membership) {
    return (
      <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <h2 style={{ fontSize: 'var(--fs-xl)', marginBottom: 'var(--sp-3)' }}>No Institute Found</h2>
        <p>You are not registered as an educator in any institute. Contact support to set up your cohort.</p>
      </div>
    );
  }

  const instituteId = membership.institute_id;
  const instituteName = (membership.institutes as any)?.name || 'Your Institute';

  // Get all students in this institute — profiles are now readable via migration 021
  const { data: students, error: studentErr } = await supabase
    .from('institute_memberships')
    .select(`
      user_id,
      profiles (
        full_name,
        email,
        emotional_state,
        current_score,
        streak_days,
        exam_type,
        exam_date
      )
    `)
    .eq('institute_id', instituteId)
    .eq('role', 'student');

  if (studentErr) {
    console.error('Educator dashboard failed to load students:', studentErr.message);
  }

  const studentList = (students || []).map(s => ({
    userId: s.user_id,
    profile: s.profiles as any,
  }));

  // Compute summary stats
  const atRisk = studentList.filter(
    s => s.profile?.emotional_state === 'overwhelmed' || s.profile?.emotional_state === 'burnt_out'
  );
  const activeToday = studentList.filter(s => (s.profile?.streak_days || 0) > 0);
  const avgScore =
    studentList.length > 0
      ? Math.round(
          studentList.reduce((sum, s) => sum + (s.profile?.current_score || 0), 0) /
            studentList.length
        )
      : 0;

  // Days to exam for each student
  const withDaysLeft = studentList.map(s => {
    const examDate = s.profile?.exam_date ? new Date(s.profile.exam_date) : null;
    const daysLeft = examDate
      ? Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86400000))
      : null;
    return { ...s, daysLeft };
  });

  const stateColor: Record<string, string> = {
    focused: 'var(--success)',
    neutral: 'var(--text-tertiary)',
    frustrated: 'var(--warning)',
    overwhelmed: 'var(--danger)',
    burnt_out: 'var(--danger)',
  };

  const stateBadgeColor: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
    focused: 'green',
    neutral: 'gray',
    frustrated: 'yellow',
    overwhelmed: 'red',
    burnt_out: 'red',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', padding: 'var(--sp-6)' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
          {instituteName}
        </h1>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-1)' }}>
          Educator Dashboard · {studentList.length} students enrolled
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
        <Card style={{ padding: 'var(--sp-4)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-1)' }}>
            TOTAL STUDENTS
          </div>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
            {studentList.length}
          </div>
        </Card>

        <Card style={{ padding: 'var(--sp-4)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-1)' }}>
            AT RISK
          </div>
          <div style={{
            fontSize: 'var(--fs-3xl)',
            fontWeight: 'var(--fw-bold)',
            color: atRisk.length > 0 ? 'var(--danger)' : 'var(--success)',
          }}>
            {atRisk.length}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            overwhelmed or burnt out
          </div>
        </Card>

        <Card style={{ padding: 'var(--sp-4)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-1)' }}>
            ACTIVE STREAKS
          </div>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--success)' }}>
            {activeToday.length}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            of {studentList.length} students
          </div>
        </Card>

        <Card style={{ padding: 'var(--sp-4)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-1)' }}>
            COHORT AVG SCORE
          </div>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
            {avgScore}
          </div>
        </Card>
      </div>

      {/* At-Risk Alert */}
      {atRisk.length > 0 && (
        <div style={{
          padding: 'var(--sp-4)',
          background: 'var(--danger-dim, rgba(239,68,68,0.08))',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--sp-3)',
        }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--danger)', marginBottom: 'var(--sp-1)' }}>
              {atRisk.length} student{atRisk.length > 1 ? 's' : ''} showing burnout signals
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              {atRisk.map(s => s.profile?.full_name || 'Unknown').join(', ')} — consider reaching out directly.
            </div>
          </div>
        </div>
      )}

      {/* Student Roster */}
      <div>
        <h2 style={{
          fontSize: 'var(--fs-lg)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--sp-4)',
        }}>
          Student Roster
        </h2>

        {studentList.length === 0 ? (
          <Card style={{ padding: 'var(--sp-8)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>
              No students enrolled yet. Share your institute code to invite students.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {withDaysLeft.map(({ userId, profile, daysLeft }) => (
              <Card
                key={userId}
                style={{
                  padding: 'var(--sp-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--sp-4)',
                  borderLeft: profile?.emotional_state === 'burnt_out' || profile?.emotional_state === 'overwhelmed'
                    ? '3px solid var(--danger)'
                    : '3px solid transparent',
                }}
              >
                {/* Student info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--fs-sm)',
                  }}>
                    {profile?.full_name || '—'}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-1)' }}>
                    {profile?.exam_type || 'General'} ·{' '}
                    {daysLeft !== null ? `${daysLeft} days to exam` : 'No exam date set'}
                  </div>
                </div>

                {/* Streak */}
                <div style={{ textAlign: 'center', minWidth: '60px' }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--warning)' }}>
                    🔥 {profile?.streak_days || 0}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>streak</div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'center', minWidth: '60px' }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
                    {profile?.current_score || 0}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>score</div>
                </div>

                {/* State badge */}
                <Badge
                  color={stateBadgeColor[profile?.emotional_state || 'neutral'] || 'gray'}
                >
                  {profile?.emotional_state || 'neutral'}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
