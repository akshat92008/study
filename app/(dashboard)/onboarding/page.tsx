import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  generateDay1Plan,
  seedInitialCards,
  seedOnboardingKnowledgeMap,
} from '@/lib/actions/onboarding';
import { logger } from '@/lib/utils/logger';
import {
  completeOnboardingForUser,
  sanitizeSubjectList,
} from '@/lib/services/onboarding.service';
import SubmitButton from '@/components/onboarding/SubmitButton';

async function completeOnboarding(formData: FormData) {
  'use server';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const fullName = String(formData.get('fullName') || '').trim();
  const goalTitle = String(formData.get('goalTitle') || '').trim();
  const goalType = String(formData.get('goalType') || 'General Study').trim();
  const targetDate = String(formData.get('targetDate') || '').trim();
  const targetScore = Number(formData.get('targetScore') || 0);
  const dailyHours = Number(formData.get('dailyHours') || 4);
  const currentLevel = String(formData.get('currentLevel') || 'intermediate').trim();
  const timezone = String(formData.get('timezone') || '').trim();
  const subjects = sanitizeSubjectList(String(formData.get('subjects') || ''));

  const completion = await completeOnboardingForUser({
    supabase,
    user,
    input: {
      fullName,
      goalTitle: goalTitle || goalType,
      goalType,
      targetDate: targetDate || null,
      targetScore: Number.isFinite(targetScore) && targetScore > 0 ? targetScore : null,
      dailyHours: Number.isFinite(dailyHours) && dailyHours > 0 ? dailyHours : 4,
      currentLevel: currentLevel as 'beginner' | 'intermediate' | 'advanced',
      subjects,
      timezone,
    },
  });

  const seedResult = await seedOnboardingKnowledgeMap(user.id, goalType, subjects)
    .catch((err) => {
      logger.warn('Onboarding ATLAS seed failed', { userId: user.id, err });
      return { skeletonCreated: 0, expansionQueued: 0 };
    });

  await generateDay1Plan(user.id, goalType).catch((err) => {
    logger.warn('Onboarding day-1 plan generation failed', { userId: user.id, err });
  });

  await seedInitialCards(user.id, { maxConcepts: 3, cardsPerConcept: 2 }).catch((err) => {
    logger.warn('Onboarding starter card generation failed', { userId: user.id, err });
  });

  const cookieStore = await cookies();
  cookieStore.set('_ob', '1', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 5,
    path: '/',
  });

  redirect(`/dashboard?magic=true&firstTime=true&goalId=${completion.goal.id}&seeded=${seedResult.skeletonCreated}`);
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, exam_type, target_date, target_score, daily_hours_available, subjects, current_level, timezone')
    .eq('id', user.id)
    .maybeSingle();

  const { data: existingGoal } = await supabase
    .from('learning_goals')
    .select('title')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingGoalType = profile?.exam_type || '';
  const existingSubjects = Array.isArray(profile?.subjects) && profile.subjects.length
    ? profile.subjects.join(', ')
    : '';

  return (
    <div style={{ padding: 'var(--sp-8)', maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 'var(--fs-2xl)', marginBottom: 'var(--sp-2)' }}>Set Up Your Learning OS</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
        Tell Cognition OS what you are trying to learn. It will build your personalised mission, tutor, and study plan.
      </p>

      <form action={completeOnboarding} style={{ display: 'grid', gap: 'var(--sp-4)' }}>

        {/* Name */}
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
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Learning Goal</span>
          <input
            name="goalTitle"
            defaultValue={existingGoal?.title || ''}
            required
            placeholder="e.g. Pass the SAT, learn Python for data analysis, master Organic Chemistry"
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        {/* Goal Type / Preset — universal dropdown */}
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>What are you preparing for or learning?</span>
          <select
            name="goalType"
            defaultValue={existingGoalType || ''}
            required
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            <option value="" disabled>Select your exam or goal...</option>
            <optgroup label="Competitive Exams">
              <option value="NEET">NEET UG (Medical Entrance)</option>
              <option value="JEE Main">JEE Main (Engineering)</option>
              <option value="JEE Advanced">JEE Advanced</option>
              <option value="UPSC">UPSC Civil Services</option>
              <option value="SAT">SAT</option>
              <option value="MCAT">MCAT</option>
              <option value="USMLE">USMLE</option>
              <option value="Bar Exam">Bar Exam</option>
              <option value="GMAT">GMAT</option>
              <option value="GRE">GRE</option>
              <option value="Other Competitive Exam">Other Competitive Exam</option>
            </optgroup>
            <optgroup label="Academic">
              <option value="School Subject">School Subject / Board Exams</option>
              <option value="College Course">College / University Course</option>
            </optgroup>
            <optgroup label="Skills">
              <option value="Coding">Coding / Programming</option>
              <option value="Data Science">Data Science / ML</option>
              <option value="Language Learning">Language Learning</option>
              <option value="Finance">Finance / CFA / CPA</option>
              <option value="Professional Certification">Professional Certification</option>
            </optgroup>
            <optgroup label="Custom">
              <option value="General Study">Custom / General Study</option>
            </optgroup>
          </select>
        </label>

        {/* Target Date */}
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Target Date (exam, deadline, or goal date)</span>
          <input
            name="targetDate"
            type="date"
            defaultValue={profile?.target_date || ''}
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        {/* Target Score — universal, optional */}
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            Target Score / Outcome <span style={{ opacity: 0.6 }}>(optional)</span>
          </span>
          <input
            name="targetScore"
            type="number"
            min="0"
            placeholder="e.g. 680 for NEET, 90 for GRE, or leave blank"
            defaultValue={profile?.target_score || ''}
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        {/* Daily Hours */}
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

        {/* Subjects / Topics — not NEET-hardcoded */}
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            Subjects / Topics <span style={{ opacity: 0.6 }}>(comma-separated, optional)</span>
          </span>
          <input
            name="subjects"
            defaultValue={existingSubjects}
            placeholder="e.g. Physics, Chemistry, Biology  or  Calculus, Algorithms  or  leave blank"
            style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        </label>

        {/* Current Level */}
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Current Level</span>
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
