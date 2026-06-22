import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  generateDay1Plan,
} from '@/lib/actions/onboarding';
import { logger } from '@/lib/utils/logger';
import {
  completeOnboardingForUser,
} from '@/lib/services/onboarding.service';
import SubmitButton from '@/components/onboarding/SubmitButton';
import { NEET_UG_2026_UNITS } from '@/lib/syllabus/neet-ug-2026';

async function completeOnboarding(formData: FormData) {
  'use server';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const fullName = String(formData.get('fullName') || '').trim();
  const startingChapter = String(formData.get('startingChapter') || '').trim();
  const [subject, chapterSlug, unitTitle] = startingChapter.split(':');

  const goalType = 'NEET';
  const goalTitle = `Master ${unitTitle}`;
  const targetDate = String(formData.get('targetDate') || '').trim();
  const targetScore = Number(formData.get('targetScore') || 0);
  const dailyHours = Number(formData.get('dailyHours') || 4);
  const currentLevel = String(formData.get('currentLevel') || 'intermediate').trim();
  const timezone = String(formData.get('timezone') || '').trim();
  const subjects = [subject];

  const completion = await completeOnboardingForUser({
    supabase,
    user,
    input: {
      fullName,
      goalTitle,
      goalType,
      targetDate: targetDate || null,
      targetScore: Number.isFinite(targetScore) && targetScore > 0 ? targetScore : null,
      dailyHours: Number.isFinite(dailyHours) && dailyHours > 0 ? dailyHours : 4,
      currentLevel: currentLevel as 'beginner' | 'intermediate' | 'advanced',
      subjects,
      timezone,
    },
  });

  const skeletonCreated = completion.topicSeeding?.seeded || 0;

  await generateDay1Plan(user.id, goalType).catch((err) => {
    logger.warn('Onboarding day-1 plan generation failed', { userId: user.id, err });
  });

  const cookieStore = await cookies();
  cookieStore.set('_ob', '1', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 5,
    path: '/',
  });

  redirect(`/dashboard?magic=true&firstTime=true&goalId=${completion.goal.id}&seeded=${skeletonCreated}`);
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete, full_name, exam_type, target_date, target_score, daily_hours_available, current_level, timezone')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.onboarding_complete) {
    redirect('/dashboard');
  }

  return (
    <div style={{ padding: 'var(--sp-8)', maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 'var(--fs-2xl)', marginBottom: 'var(--sp-2)' }}>Welcome to Cognition OS</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
        Configure your NEET preparation profile and select your starting chapter.
      </p>

      <form action={completeOnboarding} style={{ display: 'grid', gap: 'var(--sp-4)' }}>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Your Name</span>
          <input
            name="fullName"
            defaultValue={profile?.full_name || ''}
            required
            placeholder="e.g. Priya Sharma"
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Starting NEET Chapter</span>
          <select
            name="startingChapter"
            required
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            <option value="" disabled selected>Select a chapter...</option>
            <optgroup label="Biology">
              {NEET_UG_2026_UNITS.filter(u => u.subject === 'Biology').map(u => (
                <option key={u.chapterSlug} value={`Biology:${u.chapterSlug}:${u.unitTitle}`}>
                  {u.unitTitle}
                </option>
              ))}
            </optgroup>
            <optgroup label="Physics">
              {NEET_UG_2026_UNITS.filter(u => u.subject === 'Physics').map(u => (
                <option key={u.chapterSlug} value={`Physics:${u.chapterSlug}:${u.unitTitle}`}>
                  {u.unitTitle}
                </option>
              ))}
            </optgroup>
            <optgroup label="Chemistry">
              {NEET_UG_2026_UNITS.filter(u => u.subject === 'Chemistry').map(u => (
                <option key={u.chapterSlug} value={`Chemistry:${u.chapterSlug}:${u.unitTitle}`}>
                  {u.unitTitle}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Target Exam Date</span>
          <input
            name="targetDate"
            type="date"
            defaultValue={profile?.target_date || ''}
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Target Score (out of 720)</span>
          <input
            name="targetScore"
            type="number"
            min="0"
            max="720"
            placeholder="e.g. 680"
            defaultValue={profile?.target_score || ''}
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Daily Study Hours Available</span>
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
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Current level of preparation</span>
          <select
            name="currentLevel"
            defaultValue={profile?.current_level || 'intermediate'}
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            <option value="beginner">Beginner — starting fresh</option>
            <option value="intermediate">Intermediate — some foundation</option>
            <option value="advanced">Advanced — strong base, refining</option>
          </select>
        </label>

        <input type="hidden" name="timezone" defaultValue={profile?.timezone || 'UTC'} />

        <SubmitButton />
      </form>
    </div>
  );
}
