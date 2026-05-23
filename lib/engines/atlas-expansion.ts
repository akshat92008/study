import { generateJSON } from '@/lib/ai/gemini';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const ConceptExpansionSchema = z.object({
  concepts: z.array(z.object({
    name: z.string(),
    description: z.string(),
    prerequisiteNames: z.array(z.string())
  }))
});

/**
 * AI-generates 8-15 micro-concepts for any subject/chapter combination.
 * This replaces the hardcoded CHAPTER_EXPANSIONS dict and works for
 * ANY exam type, ANY subject, ANY chapter globally.
 */
export async function expandChapterWithAI(
  userId: string,
  subject: string,
  chapter: string,
  examType: string = 'General'
): Promise<Array<{ name: string; description: string; prerequisiteNames: string[] }>> {
  const cacheKey = `${subject}::${chapter}`.toLowerCase().replace(/\s+/g, '_');

  // Check DB cache first — don't re-generate concepts we already have
  const supabase = await createClient();
  const { data: existingConcepts } = await supabase
    .from('concepts')
    .select('name, description')
    .eq('user_id', userId)
    .eq('subject', subject)
    .eq('chapter', chapter)
    .limit(1);

  if (existingConcepts && existingConcepts.length > 0) {
    // Concepts already exist for this chapter — don't re-expand
    return [];
  }

  const prompt = `You are building a concept graph for ${examType} exam preparation.

Subject: ${subject}
Chapter: ${chapter}
Exam: ${examType}

Generate 8-12 SPECIFIC micro-concepts that a student must master in this chapter.
Rules:
1. Each concept must be a specific, testable unit of knowledge (not a vague topic)
2. Prerequisites must be OTHER concepts in this same list (by name)
3. Order them from foundational → advanced
4. Names should be the actual term/concept (e.g., "Kirchhoff's Current Law" not "KCL basics")
5. Descriptions should be exactly what a student needs to understand, in one sentence

Return JSON:
{
  "concepts": [
    {
      "name": "exact concept name",
      "description": "what the student must be able to do/understand",
      "prerequisiteNames": ["name of another concept in this list"]
    }
  ]
}`;

  try {
    const result = await generateJSON<z.infer<typeof ConceptExpansionSchema>>(
      'flash',
      'You are a curriculum design expert. Return valid JSON only.',
      prompt,
      ConceptExpansionSchema
    );

    return result?.concepts || [];
  } catch (err) {
    logger.error('AI concept expansion failed', { subject, chapter, err });
    // Fallback: return one generic concept so the chapter isn't empty
    return [{ name: chapter, description: `Master all core concepts in ${chapter}`, prerequisiteNames: [] }];
  }
}

/**
 * Seeds an entire subject's chapter list with AI-generated concepts.
 * Call this during onboarding or when a new goal is created.
 */
export async function seedSubjectWithAI(
  userId: string,
  goalId: string,
  subject: string,
  chapters: string[],
  examType: string
): Promise<number> {
  const supabase = await createClient();
  let totalCreated = 0;

  for (const chapter of chapters) {
    try {
      const concepts = await expandChapterWithAI(userId, subject, chapter, examType);
      if (!concepts.length) continue;

      // Insert concepts
      const conceptRecords = concepts.map(c => ({
        user_id: userId,
        goal_id: goalId,
        name: c.name,
        description: c.description,
        subject,
        chapter,
        mastery: 'not_started' as const
      }));

      const { data: inserted } = await supabase
        .from('concepts')
        .insert(conceptRecords)
        .select('id, name');

      if (!inserted) continue;

      // Build prerequisite links
      const nameToId: Record<string, string> = {};
      inserted.forEach(c => { nameToId[c.name] = c.id; });

      const links = concepts.flatMap(c => {
        const sourceId = nameToId[c.name];
        if (!sourceId) return [];
        return c.prerequisiteNames
          .map(prereqName => nameToId[prereqName])
          .filter(Boolean)
          .map(targetId => ({
            source_concept_id: targetId, // prereq must be done first
            target_concept_id: sourceId,
            link_type: 'prerequisite',
            strength: 1.0
          }));
      });

      if (links.length > 0) {
        await supabase.from('concept_links').insert(links);
      }

      totalCreated += inserted.length;
    } catch (err) {
      logger.error('Failed to seed chapter', { subject, chapter, err });
    }
  }

  return totalCreated;
}
