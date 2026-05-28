export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, safeError } from '@/lib/utils/logger';
import { 
  seedFullSyllabusForUser, 
  getSyllabusForExam, 
  generateSyllabusWithAI 
} from '@/lib/engines/atlas-expansion';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { quizResults = [] } = body;



    const { data: profile } = await supabase.from('profiles')
      .select('exam_type')
      .eq('id', user.id)
      .single();

    const examType = profile?.exam_type || 'General Study';

    // 2. Get syllabus
    let syllabus = getSyllabusForExam(examType);
    if (Object.keys(syllabus).length === 0) {
      syllabus = await generateSyllabusWithAI(examType);
    }
    // Mark onboarding complete and start seeding
    await supabase.from('profiles')
      .update({
        onboarding_complete: true,
        atlas_seeding_status: 'seeding',
        atlas_seeding_concepts_total: Object.values(syllabus).flat().length,
        atlas_seeding_concepts_done: 0,
      })
      .eq('id', user.id);

    const subjects = Object.keys(syllabus);



    // 3. SYNCHRONOUS seed of first subject — gives instant graph feedback
    const firstSubject = subjects[0];
    const restSubjects = subjects.slice(1);

    if (firstSubject) {
      await seedFullSyllabusForUser(user.id, examType, [firstSubject]).catch(err =>
          logger.error('First subject seeding failed', { userId: user.id, err })
        );
    // Update concepts done after first subject seeding
    await supabase.from('profiles')
      .update({ atlas_seeding_concepts_done: subjects[0] ? 1 : 0 })
      .eq('id', user.id);
    }

    // 4. IMMEDIATELY apply quiz results to mark weak concepts
    // This is the critical missing step — quizResults were parsed but never used
    if (quizResults.length > 0) {
      const wrongChapters = quizResults
        .filter((r: any) => !r.isCorrect)
        .map((r: any) => r.chapter)
        .filter(Boolean);

      if (wrongChapters.length > 0) {
        await supabase.from('concepts')
          .update({ 
            mastery: 'exposed', 
            confidence: 'very_low',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .in('chapter', wrongChapters);

        // Also log these as mistakes so AUTOPSY engine has baseline data
        const mistakeInserts = quizResults
          .filter((r: any) => !r.isCorrect)
          .map((r: any) => ({
            user_id: user.id,
            chapter: r.chapter,
            concept: r.concept,
            category: 'conceptual_gap',
            subject: examType,
            source: 'onboarding_diagnostic',
            created_at: new Date().toISOString()
          }));

        if (mistakeInserts.length > 0) {
          try {
            await supabase.from('mistakes').insert(mistakeInserts);
          } catch (err) {
            logger.error('Failed to seed mistakes on onboarding', { error: err });
          }
        }
      }
    }

    // 5. Seed rest of subjects in background — don't block response
      if (restSubjects.length > 0) {
        seedFullSyllabusForUser(user.id, examType, restSubjects)
          .then(async () => {
            await supabase.from('profiles').update({
              atlas_seeding_status: 'complete',
              atlas_seeding_concepts_done: subjects.length,
            }).eq('id', user.id);
          })
          .catch(async (err) => {
            logger.error('Background syllabus seeding failed', { userId: user.id, err });
            await supabase.from('profiles').update({
              atlas_seeding_status: 'failed',
            }).eq('id', user.id);
          });
      }

    // 6. Generate initial flashcards for the first-seeded subject in background
    generateInitialCardSet(user.id, examType).catch(err =>
      logger.error('Background card generation failed', { userId: user.id, err })
    );

    // 7. Return how many concepts were seeded so the UI can confirm
    const { count: seededCount } = await supabase
      .from('concepts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return NextResponse.json({ 
      success: true, 
      conceptsSeeded: seededCount || 0,
      firstSubjectReady: !!firstSubject 
    });

  } catch (error: any) {
    logger.error('Onboarding completion failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}

async function generateInitialCardSet(userId: string, examType: string): Promise<void> {
  const supabase = await createClient();

  // Wait for concepts to exist (background seeding may still be running)
  let seedConcepts: any[] | null = null;
  for (let i = 0; i < 8; i++) {
    const { data } = await supabase
      .from('concepts')
      .select('id, name, subject, chapter')
      .eq('user_id', userId)
      .eq('mastery', 'not_started')
      .order('created_at', { ascending: true })
      .limit(10);

    if (data && data.length > 0) { seedConcepts = data; break; }
    await new Promise(r => setTimeout(r, 2500));
  }

  if (!seedConcepts || seedConcepts.length === 0) return;

  const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');
  for (const concept of seedConcepts) {
    try {
      await generateCardsForConcept(userId, concept.id, concept.subject, concept.chapter);
      await new Promise(r => setTimeout(r, 400));
    } catch (err: any) {
      logger.warn('Card gen failed', { conceptId: concept.id, err: err.message });
    }
  }
}
