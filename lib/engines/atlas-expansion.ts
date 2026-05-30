import { generateJSON } from '@/lib/ai/provider-client';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

// Cache expanded chapters to avoid regenerating on every call
const expansionCache = new Map<string, MicroConcept[]>();

const MicroConceptSchema = z.object({
  concepts: z.array(z.object({
    name: z.string(),
    description: z.string(),
    importance: z.enum(['core', 'supporting', 'advanced']),
    prerequisites: z.array(z.string())
  }))
});

export type MicroConcept = {
  name: string;
  description: string;
  importance: 'core' | 'supporting' | 'advanced';
  prerequisites: string[];
};

export async function expandChapterToMicroConcepts(
  subject: string,
  chapter: string,
  examType: string
): Promise<MicroConcept[]> {
  const cacheKey = `${examType}:${subject}:${chapter}`;
  if (expansionCache.has(cacheKey)) {
    return expansionCache.get(cacheKey)!;
  }

  const supabase = await createClient();

  try {
    // Check DB template cache first (L2 Cache)
    const { data: template } = await supabase
      .from('concept_templates')
      .select('concepts_json')
      .eq('exam_type', examType)
      .eq('subject', subject)
      .eq('chapter', chapter)
      .maybeSingle();

    if (template?.concepts_json) {
      const concepts = template.concepts_json as MicroConcept[];
      expansionCache.set(cacheKey, concepts); // Fill L1 cache
      return concepts;
    }
  } catch (dbErr) {
    logger.warn('Failed to query concept template cache', { examType, subject, chapter, dbErr });
  }

  const prompt = `You are a curriculum expert for ${examType} exams.

Break down the chapter "${chapter}" from the subject "${subject}" into specific micro-concepts that students need to master individually for ${examType}.

Rules:
- Return 6 to 12 micro-concepts. Not more, not fewer.
- Each concept must be a specific, testable unit of knowledge — not vague like "basics of X"
- Mark prerequisite concepts that must be mastered BEFORE this one can be understood
- Importance: "core" = directly tested, "supporting" = needed to understand core, "advanced" = high difficulty, often differentiates toppers

Examples of good micro-concepts for "Electrochemistry" (NEET Chemistry):
- "Nernst equation and EMF calculation"
- "Kohlrausch law and molar conductivity"
- "Faraday's laws of electrolysis with numerical application"

Return only valid JSON matching the schema.`;

  try {
    const result = await generateJSON<z.infer<typeof MicroConceptSchema>>(
      'flash', // Use flash for cost efficiency — this runs at onboarding
      'You are a curriculum expert. Return only valid JSON.',
      prompt,
      MicroConceptSchema,
      0.3
    );

    const concepts = result.concepts || [];
    expansionCache.set(cacheKey, concepts); // Fill L1 cache

    // Store in Supabase cache (L2 Cache) asynchronously
    supabase.from('concept_templates').insert({
      exam_type: examType,
      subject,
      chapter,
      concepts_json: concepts
    }).then(({ error }) => {
      if (error) {
        logger.error('Failed to cache concept template', { examType, subject, chapter, error });
      }
    });

    return concepts;
  } catch (err) {
    logger.error('Chapter expansion failed', { subject, chapter, examType, err });
    // Fallback: return a single generic concept so the graph doesn't break
    return [{
      name: chapter,
      description: `Core concepts of ${chapter} as required for ${examType}`,
      importance: 'core',
      prerequisites: []
    }];
  }
}

export async function seedFullSyllabusForUser(
  userId: string,
  examType: string,
  subjects: string[]
): Promise<void> {
  const supabase = await createClient();

  // Get the syllabus for this exam type
  let syllabusMap = getSyllabusForExam(examType);
  if (Object.keys(syllabusMap).length === 0) {
    syllabusMap = await generateSyllabusWithAI(examType);
  }

  for (const subject of subjects) {
    const chapters = syllabusMap[subject] || [];

    for (const chapter of chapters) {
      // Check if we already seeded this chapter
      const { count } = await supabase
        .from('concepts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('chapter', chapter);

      if ((count || 0) > 0) continue; // Already seeded

      // Expand chapter into micro-concepts
      const microConcepts = await expandChapterToMicroConcepts(subject, chapter, examType);

      // Insert all micro-concepts for this chapter
      const inserts = microConcepts.map(mc => ({
        user_id: userId,
        subject,
        chapter,
        name: mc.name,
        description: mc.description,
        mastery: 'not_started' as const,
        importance: mc.importance
      }));

      if (inserts.length > 0) {
        const { error } = await supabase.from('concepts').insert(inserts);
        if (error) {
          logger.error('Failed to insert micro-concepts', { subject, chapter, error });
        }
      }

      // Small delay to avoid rate limiting on the AI API
      await new Promise(r => setTimeout(r, 200));
    }
  }

  logger.info('Full syllabus seeded', { userId, examType, subjects });
}

export async function getUserSyllabus(
  userId: string,
  examType: string
): Promise<{ subjects: string[]; chapters: Record<string, string[]> }> {
  const known = getSyllabusForExam(examType);
  if (Object.keys(known).length > 0) {
    return {
      subjects: Object.keys(known),
      chapters: known
    };
  }

  const supabase = await createClient();
  const { data: concepts } = await supabase
    .from('concepts')
    .select('subject, chapter')
    .eq('user_id', userId);

  if (concepts && concepts.length > 0) {
    const subjectsMap: Record<string, string[]> = {};
    concepts.forEach((c: any) => {
      if (!subjectsMap[c.subject]) {
        subjectsMap[c.subject] = [];
      }
      if (!subjectsMap[c.subject].includes(c.chapter)) {
        subjectsMap[c.subject].push(c.chapter);
      }
    });
    return {
      subjects: Object.keys(subjectsMap),
      chapters: subjectsMap
    };
  }

  // Fallback to generating it if concepts aren't seeded yet
  const aiSyllabus = await generateSyllabusWithAI(examType);
  return {
    subjects: Object.keys(aiSyllabus),
    chapters: aiSyllabus
  };
}

// Backward compatibility wrapper for cognition-graph
export async function expandChapterWithAI(
  userId: string,
  subject: string,
  chapter: string,
  examType: string = 'General'
): Promise<Array<{ name: string; description: string; prerequisiteNames: string[] }>> {
  const supabase = await createClient();
  const { data: existingConcepts } = await supabase
    .from('concepts')
    .select('name, description')
    .eq('user_id', userId)
    .eq('subject', subject)
    .eq('chapter', chapter)
    .limit(1);

  if (existingConcepts && existingConcepts.length > 0) {
    return [];
  }

  const microConcepts = await expandChapterToMicroConcepts(subject, chapter, examType);
  return microConcepts.map(mc => ({
    name: mc.name,
    description: mc.description,
    prerequisiteNames: mc.prerequisites
  }));
}

export function getSyllabusForExam(examType: string): Record<string, string[]> {
  // Only return hardcoded syllabuses for exams where the official syllabus
  // is fixed and well-known. For everything else, return {} so the caller
  // knows to use generateSyllabusWithAI() instead.
  const normalized = examType?.toUpperCase().trim() || '';
  if (normalized.includes('NEET')) {
    return {
      Physics: ['Physical World and Measurement','Kinematics','Laws of Motion','Work Energy and Power','Motion of System of Particles','Gravitation','Properties of Bulk Matter','Thermodynamics','Behaviour of Perfect Gas','Oscillations and Waves','Electrostatics','Current Electricity','Magnetic Effects of Current','Magnetism and Matter','Electromagnetic Induction','Alternating Currents','Electromagnetic Waves','Ray Optics','Wave Optics','Dual Nature of Matter','Atoms and Nuclei','Electronic Devices'],
      Chemistry: ['Some Basic Concepts of Chemistry','Structure of Atom','Classification of Elements','Chemical Bonding','States of Matter','Thermodynamics','Equilibrium','Redox Reactions','s-Block Elements','p-Block Elements','Organic Chemistry Basics','Hydrocarbons','The Solid State','Solutions','Electrochemistry','Chemical Kinetics','Surface Chemistry','d-Block Elements','Coordination Compounds','Haloalkanes','Alcohols Phenols Ethers','Aldehydes Ketones','Carboxylic Acids','Amines','Biomolecules','Polymers'],
      Biology: ['The Living World','Biological Classification','Plant Kingdom','Animal Kingdom','Morphology of Flowering Plants','Anatomy of Flowering Plants','Structural Organisation in Animals','Cell: The Unit of Life','Biomolecules','Cell Cycle and Cell Division','Transport in Plants','Mineral Nutrition','Photosynthesis in Higher Plants','Respiration in Plants','Plant Growth and Development','Digestion and Absorption','Breathing and Exchange of Gases','Body Fluids and Circulation','Excretory Products and Their Elimination','Locomotion and Movement','Neural Control and Coordination','Chemical Coordination and Integration','Reproduction in Organisms','Sexual Reproduction in Flowering Plants','Human Reproduction','Reproductive Health','Principles of Inheritance and Variation','Molecular Basis of Inheritance','Evolution','Human Health and Disease','Strategies for Enhancement in Food Production','Microbes in Human Welfare','Biotechnology Principles and Processes','Biotechnology and its Applications','Organisms and Populations','Ecosystem','Biodiversity and Conservation','Environmental Issues']
    };
  }
  if (normalized.includes('JEE')) {
    return {
      Physics: [
        'Kinematics','Laws of Motion','Work Energy and Power','Rotational Motion',
        'Gravitation','Properties of Matter','Thermal Properties','Thermodynamics',
        'Kinetic Theory','Oscillations','Waves','Electrostatics','Current Electricity',
        'Magnetic Effects of Current','Electromagnetic Induction','Alternating Current',
        'Electromagnetic Waves','Ray Optics','Wave Optics','Modern Physics','Semiconductors'
      ],
      Chemistry: [
        'Mole Concept','Atomic Structure','Chemical Bonding','States of Matter',
        'Thermodynamics','Chemical Equilibrium','Ionic Equilibrium','Electrochemistry',
        'Chemical Kinetics','Solutions','Surface Chemistry','Metallurgy',
        's-Block Elements','p-Block Elements','d-Block Elements','Coordination Compounds',
        'Hydrocarbons','Halogen Derivatives','Alcohols and Ethers','Carbonyl Compounds',
        'Carboxylic Acids','Amines','Biomolecules and Polymers'
      ],
      Mathematics: [
        'Sets and Relations','Complex Numbers','Quadratic Equations','Sequences and Series',
        'Permutations and Combinations','Binomial Theorem','Matrices and Determinants',
        'Straight Lines','Circles','Conic Sections','3D Geometry','Vectors',
        'Limits and Continuity','Differentiation','Applications of Derivatives',
        'Indefinite Integration','Definite Integration','Differential Equations',
        'Trigonometry','Inverse Trigonometry','Statistics and Probability'
      ]
    };
  }
  // Everything else gets AI-generated
  return {};
}

const aiSyllabusCache = new Map<string, Record<string, string[]>>();

export async function generateSyllabusWithAI(studyTopic: string): Promise<Record<string, string[]>> {
  const cacheKey = studyTopic.toLowerCase().trim();
  if (aiSyllabusCache.has(cacheKey)) return aiSyllabusCache.get(cacheKey)!;

  const prompt = `A student wants to study: "${studyTopic}"

Generate a structured learning curriculum broken into subjects and chapters.

Rules:
- 1 to 3 subjects (logical top-level groupings for this topic)
- 5 to 10 chapters per subject — use real chapter/topic names, not generic ones like "Introduction" or "Basics"
- Think like a teacher building a course for this exact topic

Examples of good output:
- "Class 10 Science" → subjects: Physics, Chemistry, Biology with actual NCERT chapter names
- "React development" → subjects: Core Concepts, State Management, Ecosystem with real topic names  
- "IELTS" → subjects: Reading, Writing, Listening, Speaking with task-type chapters
- "Macroeconomics" → subjects: Fundamentals, Policy, Global Economics with real topics
- "Guitar for beginners" → subjects: Technique, Theory, Repertoire with progressive chapters
- "French A2" → subjects: Grammar, Vocabulary, Conversation with level-appropriate topics

Return ONLY valid JSON — no extra text:
{
  "syllabus": {
    "Subject Name": ["Chapter 1", "Chapter 2", "Chapter 3"],
    "Subject Name 2": ["Chapter A", "Chapter B"]
  }
}`;

  try {
    const SyllabusSchema = z.object({
      syllabus: z.record(z.array(z.string()))
    });
    const result = await generateJSON<z.infer<typeof SyllabusSchema>>(
      'flash',
      'You are a curriculum designer. Return only valid JSON.',
      prompt,
      SyllabusSchema,
      0.3
    );
    const syllabus = result?.syllabus || {};
    if (Object.keys(syllabus).length > 0) {
      aiSyllabusCache.set(cacheKey, syllabus);
      return syllabus;
    }
    throw new Error('Empty syllabus returned');
  } catch (err) {
    logger.error('AI syllabus generation failed', { studyTopic, err });
    return { [studyTopic]: ['Core Concepts', 'Key Principles', 'Applied Practice', 'Problem Solving', 'Advanced Topics'] };
  }
}
