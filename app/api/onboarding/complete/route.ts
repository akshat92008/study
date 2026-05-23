import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, safeError } from '@/lib/utils/logger';
import { seedFullSyllabusForUser, getSyllabusForExam } from '@/lib/engines/atlas-expansion';

// After graph seeding, fire card generation for the top weak concepts
// Do this async so onboarding doesn't hang
async function generateInitialCardSet(userId: string, examType: string): Promise<void> {
  const supabase = await createClient();

  // Retry loop to wait for background seeding to insert the first concepts
  let seedConcepts: any[] | null = null;
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from('concepts')
      .select('id, name, subject, chapter')
      .eq('user_id', userId)
      .eq('mastery', 'not_started')
      .order('created_at', { ascending: true })
      .limit(10);

    if (data && data.length > 0) {
      seedConcepts = data;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!seedConcepts || seedConcepts.length === 0) {
    logger.warn('Initial card generation skipped: no concepts found after waiting', { userId });
    return;
  }

  const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');

  for (const concept of seedConcepts) {
    try {
      await generateCardsForConcept(userId, concept.id, concept.subject, concept.chapter);
      // Rate limit: don't hammer the AI API
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      logger.warn('Initial card generation failed for concept', { conceptId: concept.id, err: err.message });
    }
  }

  logger.info('Initial card set generated', { userId, cardCount: seedConcepts.length });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Mark onboarding complete on the profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        onboarding_complete: true,
      })
      .eq('id', user.id);

    if (profileErr) {
      logger.warn('Failed to mark onboarding complete', { userId: user.id, err: profileErr.message });
    }

    // Get the student's exam type to seed the appropriate syllabus
    const { data: profile } = await supabase
      .from('profiles')
      .select('exam_type')
      .eq('id', user.id)
      .single();

    const examType = profile?.exam_type || 'NEET';
    const subjects = Object.keys(getSyllabusForExam(examType));

    // Fire async — don't make user wait for full seeding
    seedFullSyllabusForUser(user.id, examType, subjects).catch(err =>
      logger.error('Background syllabus seeding failed', { userId: user.id, err })
    );

    // Fire card generation for the top weak concepts asynchronously
    generateInitialCardSet(user.id, examType).catch(err =>
      logger.error('Background card generation failed', { userId: user.id, err })
    );

    return NextResponse.json({ success: true, message: 'Onboarding complete. Cards being generated.' });

  } catch (error: any) {
    logger.error('Onboarding completion failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
