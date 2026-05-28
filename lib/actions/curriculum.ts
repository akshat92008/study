'use server';

import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { seedConceptsForSubject } from '@/lib/engines/cognition-graph';

export async function generateDynamicCurriculum(topic: string, academicLevel: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Generate the curriculum structure via AI
  const prompt = `Generate a comprehensive learning curriculum for:
Topic: ${topic}
Academic Level: ${academicLevel}

Break this down into 2-4 core Subjects. For each Subject, provide 5-8 logical Chapters.
Make it rigorous, structured, and comprehensive.

Respond exactly as this JSON structure:
{
  "subjects": [
    {
      "name": "Subject Name",
      "chapters": ["Chapter 1", "Chapter 2", "..."]
    }
  ]
}`;

  const curriculum = await generateJSON<{ subjects: { name: string, chapters: string[] }[] }>(
    'pro', 
    'You are an elite academic curriculum designer.', 
    prompt
  );

  if (!curriculum || !curriculum.subjects) return { error: 'Failed to generate curriculum' };

  // Update user profile with the new custom target
  await supabase.from('profiles').update({
    exam_type: topic,
    target_year: new Date().getFullYear(),
    onboarding_complete: true,
  }).eq('id', user.id);

  // NEW: Force Deep AI Expansion during Curriculum Generation
  const { expandChapterViaMind } = await import('@/lib/engines/cognition-graph');
  
  for (const subject of curriculum.subjects) {
    for (const chapter of subject.chapters) {
      // Ask Gemini to break down this specific custom chapter into micro-concepts
      const expandedConcepts = await expandChapterViaMind(user.id, subject.name, chapter);
      
      // Fallback if AI fails: seed generic chapter node
      if (!expandedConcepts || expandedConcepts.length === 0) {
        await supabase.from('concepts').insert({
          user_id: user.id, name: chapter, subject: subject.name, chapter, topic: 'General'
        });
      }
    }
  }

  return { success: true, curriculum };
}
