import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function completeOnboarding(formData: FormData) {
  'use server';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const fullName = String(formData.get('fullName') || '').trim();
  const examType = String(formData.get('examType') || 'General Study').trim();
  const targetDate = String(formData.get('targetDate') || '').trim();
  const targetScore = Number(formData.get('targetScore') || 0);
  const dailyHours = Number(formData.get('dailyHours') || 4);
  const currentLevel = String(formData.get('currentLevel') || 'intermediate').trim();
  const subjects = String(formData.get('subjects') || '')
    .split(',')
    .map((subject) => subject.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: fullName || user.email || 'Student',
      exam_type: examType || 'General Study',
      target_date: targetDate || null,
      target_score: Number.isFinite(targetScore) && targetScore > 0 ? targetScore : null,
      daily_hours_available: Number.isFinite(dailyHours) && dailyHours > 0 ? dailyHours : 4,
      daily_hours: Number.isFinite(dailyHours) && dailyHours > 0 ? dailyHours : 4,
      subjects,
      current_level: currentLevel || 'intermediate',
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to complete onboarding: ${error.message}`);
  }

  const cookieStore = await cookies();
  cookieStore.set('_ob', '1', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 5,
    path: '/',
  });

  redirect('/chat');
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, exam_type, target_date, target_score, daily_hours_available, subjects, current_level')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div style={{ padding: 'var(--sp-8)', maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 'var(--fs-2xl)', marginBottom: 'var(--sp-2)' }}>Set Up Your MVP Loop</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
        Add the minimum learner context needed for Today, MIND, ATLAS, MEMORY, and AUTOPSY.
      </p>

      <form action={completeOnboarding} style={{ display: 'grid', gap: 'var(--sp-4)' }}>
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Name</span>
          <input
            name="fullName"
            defaultValue={profile?.full_name || ''}
            required
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Exam Or Goal</span>
          <input
            name="examType"
            defaultValue={profile?.exam_type || 'NEET'}
            required
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Target Date</span>
          <input
            name="targetDate"
            type="date"
            defaultValue={profile?.target_date || ''}
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Target Score</span>
          <input
            name="targetScore"
            type="number"
            min="0"
            defaultValue={profile?.target_score || ''}
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Daily Available Hours</span>
          <input
            name="dailyHours"
            type="number"
            min="1"
            max="14"
            step="0.5"
            defaultValue={profile?.daily_hours_available || 4}
            required
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Subjects</span>
          <input
            name="subjects"
            defaultValue={Array.isArray(profile?.subjects) && profile.subjects.length ? profile.subjects.join(', ') : 'Physics, Chemistry, Biology'}
            required
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Current Level</span>
          <select
            name="currentLevel"
            defaultValue={profile?.current_level || 'intermediate'}
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <button
          type="submit"
          style={{ marginTop: 'var(--sp-2)', padding: '12px 16px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
        >
          Continue To MIND
        </button>
      </form>
    </div>
  );
}
