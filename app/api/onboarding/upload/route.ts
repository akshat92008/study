import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { genai } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const MAX_FILE_SIZE = Infinity; // Unlimited limit
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

    // 1. Convert file data for Gemini API
    let filePart: any;
    if (mimeType.startsWith('text/')) {
      filePart = { text: await file.text() };
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      filePart = { inlineData: { mimeType, data: base64 } };
    }

    // 2. Instruct Gemini to extract subjects/chapters
    const prompt = `
      You are an expert curriculum extractor. 
      Analyze the attached syllabus, exam description, course overview, or textbook document.
      Extract a structured list of subjects, and for each subject, a list of chapters.
      Keep names concise, standard, and highly relevant. Limit the total number of subjects to max 3, and chapters per subject to max 5 to speed up graph seeding.
      
      Respond STRICTLY in the requested JSON format.
    `;

    logger.info('Processing syllabus upload via Gemini', { userId: user.id, fileName: file.name });

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [filePart, { text: prompt }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            syllabusTitle: { type: 'string' },
            subjects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  chapters: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['name', 'chapters']
              }
            }
          },
          required: ['syllabusTitle', 'subjects']
        },
        temperature: 0.2,
      }
    });

    const rawText = (response.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = SyllabusSchema.parse(JSON.parse(rawText));

    const examTitle = parsedData.syllabusTitle || 'Uploaded Syllabus';

    // 3. Update User Profile with the syllabus title
    await supabase.from('profiles').update({
      exam_type: examTitle,
      target_year: new Date().getFullYear(),
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
        description: 'Take a brief break to cement neural pathways.',
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
