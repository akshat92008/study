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

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: fullName || user.email || 'Student',
      exam_type: examType || 'General Study',
      target_date: targetDate || null,
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

  redirect('/dashboard');
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, exam_type, target_date')
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

        <button
          type="submit"
          style={{ marginTop: 'var(--sp-2)', padding: '12px 16px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
        >
          Continue To Dashboard
        </button>
      </form>
    </div>
  );
}
