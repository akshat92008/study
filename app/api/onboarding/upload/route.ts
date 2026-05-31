export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider-client';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import pdf from 'pdf-parse';
import { runOCR } from '@/utils/ocr';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 
  'text/plain', 
  'text/markdown',
  'image/jpeg', 
  'image/png', 
  'image/webp'
]);

const SyllabusSchema = z.object({
  syllabusTitle: z.string(),
  subjects: z.array(
    z.object({
      name: z.string(),
      chapters: z.array(z.string())
    })
  )
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit.' }, { status: 413 });
    }

    const mimeType = file.type || 'text/plain';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, TXT, or Image.' }, { status: 415 });
    }

    const { validateMagicBytes } = await import('@/lib/utils/magicBytes');
    const isValidBytes = await validateMagicBytes(file, mimeType);
    if (!isValidBytes) {
      return NextResponse.json(
        { error: 'File contents do not match the declared MIME type. Potential malware blocked.' },
        { status: 422 }
      );
    }

    // 1. Extract text locally, then route the structured extraction through
    // the configured provider stack. Do not call the legacy genai stub.
    let extractedText = '';
    if (mimeType.startsWith('text/')) {
      extractedText = await file.text();
    } else if (mimeType === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const parsed = await pdf(Buffer.from(arrayBuffer));
      extractedText = parsed.text;
    } else if (mimeType.startsWith('image/')) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      extractedText = await runOCR(base64, mimeType);
    } else {
      extractedText = file.name;
    }

    const sourceText = extractedText.trim().slice(0, 30_000);
    if (!sourceText) {
      return NextResponse.json({ error: 'Could not extract readable text from the uploaded file.' }, { status: 422 });
    }

    // 2. Extract subjects/chapters
    const prompt = `
      You are an expert curriculum extractor. 
      Analyze this syllabus, exam description, course overview, or textbook excerpt.
      Extract a structured list of subjects, and for each subject, a list of chapters.
      Keep names concise, standard, and highly relevant. Limit the total number of subjects to max 3, and chapters per subject to max 5 to speed up graph seeding.
      
      Respond STRICTLY in the requested JSON format.

      File name: ${file.name}
      Extracted content:
      ${sourceText}
    `;

    logger.info('Processing syllabus upload', { userId: user.id, fileName: file.name });

    const parsedData = await generateJSON<z.infer<typeof SyllabusSchema>>(
      'flash',
      'You extract curricula into valid JSON only.',
      prompt,
      SyllabusSchema,
      0.2
    );

    const examTitle = parsedData.syllabusTitle || 'Uploaded Syllabus';

    // 3. Update User Profile with the syllabus title
    await supabase.from('profiles').update({
      exam_type: examTitle,
      onboarding_complete: true,
      updated_at: new Date().toISOString()
    }).eq('id', user.id);

    // 4. Seed ATLAS Concept Nodes
    const { expandChapterViaMind } = await import('@/lib/engines/cognition-graph');
    
    let seededCount = 0;
    const allSeededChapters: { subject: string; chapter: string }[] = [];

    for (const subject of parsedData.subjects) {
      for (const chapter of subject.chapters) {
        // Expand chapter into micro-concepts
        const concepts = await expandChapterViaMind(user.id, subject.name, chapter);
        if (concepts && concepts.length > 0) {
          seededCount += concepts.length;
        } else {
          // Fallback seeding of chapter itself
          await supabase.from('concepts').insert({
            user_id: user.id,
            name: chapter,
            subject: subject.name,
            chapter,
            topic: 'General',
            mastery: 'exposed',
            confidence: 'low'
          });
          seededCount++;
        }
        allSeededChapters.push({ subject: subject.name, chapter });
      }
    }

    // 5. Generate Day 1 Study Plan & Cards
    const tasks: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    if (allSeededChapters.length > 0) {
      // Pick first seeded chapter as priority focus
      const focus = allSeededChapters[0];
      
      tasks.push({
        user_id: user.id,
        title: `Deep dive: ${focus.chapter}`,
        description: `Explore the foundational concepts of ${focus.chapter} inside your custom curriculum.`,
        type: 'study',
        subject: focus.subject,
        chapter: focus.chapter,
        priority: 'critical',
        estimated_minutes: 25,
        scheduled_date: today,
        notes: `AI-prioritized focus block generated from your uploaded document: "${examTitle}".`
      });

      // Add a strategic break
      tasks.push({
        user_id: user.id,
        title: 'Cognitive rest & hydration',
        description: 'Take a brief break to consolidate the session.',
        type: 'break',
        priority: 'medium',
        estimated_minutes: 10,
        scheduled_date: today,
        notes: 'Rest is part of the training cycle.'
      });

      await supabase.from('study_tasks').insert(tasks);

      // Auto-generate some revision cards for the focus concept
      try {
        const { data: firstConcept } = await supabase
          .from('concepts')
          .select('id')
          .eq('user_id', user.id)
          .eq('chapter', focus.chapter)
          .limit(1)
          .single();

        if (firstConcept) {
          const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');
          await generateCardsForConcept(user.id, firstConcept.id, focus.subject, focus.chapter);
        }
      } catch (cardError) {
        logger.error('Failed to auto-generate cards during upload seeding', cardError);
      }
    }

    logger.info('Onboarding syllabus ingestion successful', { userId: user.id, seededCount });

    return NextResponse.json({
      success: true,
      title: examTitle,
      seededCount,
      subjects: parsedData.subjects
    });

  } catch (error: any) {
    logger.error('Failed to upload onboarding syllabus', error);
    return NextResponse.json({ error: error.message || 'Failed to process document' }, { status: 500 });
  }
}
