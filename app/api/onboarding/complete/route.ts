export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, safeError } from '@/lib/utils/logger';
import { seedFullSyllabusForUser, getSyllabusForExam, generateSyllabusWithAI } from '@/lib/engines/atlas-expansion';

async function generateInitialCardSet(userId: string, examType: string): Promise<void> {
  const supabase = await createClient();
  let seedConcepts: any[] | null = null;

  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from('concepts')
      .select('id, name, subject, chapter')
      .eq('user_id', userId)
      .eq('mastery', 'not_started')
      .order('created_at', { ascending: true })
      .limit(10);

    if (data && data.length > 0) { seedConcepts = data; break; }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!seedConcepts || seedConcepts.length === 0) return;

  const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');
  for (const concept of seedConcepts) {
    try {
      await generateCardsForConcept(userId, concept.id, concept.subject, concept.chapter);
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      logger.warn('Card gen failed', { conceptId: concept.id, err: err.message });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Parse request body to get quiz results
    const body = await req.json();
    const { quizResults = [] } = body;

    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('exam_type')
      .eq('id', user.id)
      .single();

    // Use whatever the student typed — no NEET default
    const examType = profile?.exam_type || 'General Study';

    // Get syllabus — use hardcoded for known exams, AI-generated for everything else
    let syllabus = getSyllabusForExam(examType);
    if (Object.keys(syllabus).length === 0) {
      // Unknown exam/subject — generate curriculum with AI
      syllabus = await generateSyllabusWithAI(examType);
    }

    const subjects = Object.keys(syllabus);

    // Seed ATLAS in background — don't block the response
    seedFullSyllabusForUser(user.id, examType, subjects).catch(err =>
      logger.error('Background syllabus seeding failed', { userId: user.id, err })
    );

    generateInitialCardSet(user.id, examType).catch(err =>
      logger.error('Background card generation failed', { userId: user.id, err })
    );

    return NextResponse.json({ success: true });

  } catch (error: any) {
    logger.error('Onboarding completion failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
