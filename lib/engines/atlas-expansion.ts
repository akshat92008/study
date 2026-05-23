import { generateJSON } from '@/lib/ai/gemini';
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
    expansionCache.set(cacheKey, concepts);
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
  const syllabusMap = getSyllabusForExam(examType);

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

// Comprehensive exam syllabuses
// Add more exams here as you expand market
export function getSyllabusForExam(examType: string): Record<string, string[]> {
  const syllabuses: Record<string, Record<string, string[]>> = {
    NEET: {
      Physics: [
        'Physical World and Measurement', 'Kinematics', 'Laws of Motion',
        'Work Energy and Power', 'Motion of System of Particles', 'Gravitation',
        'Properties of Bulk Matter', 'Thermodynamics', 'Behaviour of Perfect Gas',
        'Oscillations and Waves', 'Electrostatics', 'Current Electricity',
        'Magnetic Effects of Current', 'Magnetism and Matter',
        'Electromagnetic Induction', 'Alternating Currents',
        'Electromagnetic Waves', 'Ray Optics', 'Wave Optics',
        'Dual Nature of Matter', 'Atoms and Nuclei',
        'Electronic Devices', 'Communication Systems'
      ],
      Chemistry: [
        'Some Basic Concepts of Chemistry', 'Structure of Atom',
        'Classification of Elements', 'Chemical Bonding', 'States of Matter',
        'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'Hydrogen',
        's-Block Elements', 'p-Block Elements', 'Organic Chemistry Basics',
        'Hydrocarbons', 'Environmental Chemistry', 'Solid State',
        'Solutions', 'Electrochemistry', 'Chemical Kinetics',
        'Surface Chemistry', 'd-Block Elements', 'Coordination Compounds',
        'Haloalkanes', 'Alcohols Phenols Ethers', 'Aldehydes Ketones',
        'Carboxylic Acids', 'Amines', 'Biomolecules', 'Polymers'
      ],
      Biology: [
        'The Living World', 'Biological Classification', 'Plant Kingdom',
        'Animal Kingdom', 'Morphology of Flowering Plants',
        'Anatomy of Flowering Plants', 'Structural Organisation in Animals',
        'Cell Structure and Function', 'Biomolecules', 'Cell Cycle',
        'Transport in Plants', 'Mineral Nutrition', 'Photosynthesis',
        'Respiration in Plants', 'Plant Growth', 'Digestion and Absorption',
        'Breathing and Exchange of Gases', 'Body Fluids and Circulation',
        'Excretory Products', 'Locomotion and Movement',
        'Neural Control', 'Chemical Coordination', 'Reproduction in Organisms',
        'Sexual Reproduction in Plants', 'Human Reproduction',
        'Reproductive Health', 'Principles of Inheritance',
        'Molecular Basis of Inheritance', 'Evolution',
        'Human Health and Disease', 'Strategies for Enhancement',
        'Microbes in Human Welfare', 'Biotechnology Principles',
        'Biotechnology Applications', 'Organisms and Populations',
        'Ecosystem', 'Biodiversity', 'Environmental Issues'
      ]
    },
    JEE: {
      Physics: [
        'Mechanics', 'Thermal Physics', 'Electromagnetism',
        'Optics', 'Modern Physics', 'Waves and Sound'
      ],
      Chemistry: [
        'Physical Chemistry', 'Inorganic Chemistry', 'Organic Chemistry'
      ],
      Mathematics: [
        'Algebra', 'Coordinate Geometry', 'Calculus',
        'Vectors and 3D', 'Trigonometry', 'Statistics and Probability'
      ]
    },
    UPSC: {
      'General Studies 1': [
        'Indian History', 'World History', 'Indian Geography',
        'World Geography', 'Indian Society', 'Social Issues'
      ],
      'General Studies 2': [
        'Indian Polity', 'Constitution', 'Governance',
        'Social Justice', 'International Relations'
      ],
      'General Studies 3': [
        'Indian Economy', 'Agriculture', 'Science and Technology',
        'Environment', 'Disaster Management', 'Security'
      ],
      'General Studies 4': [
        'Ethics and Integrity', 'Attitude', 'Aptitude',
        'Emotional Intelligence', 'Public Service Values'
      ]
    },
    CFA: {
      'Quantitative Methods': [
        'Time Value of Money', 'Statistical Concepts', 'Probability',
        'Common Distributions', 'Sampling and Estimation', 'Hypothesis Testing',
        'Technical Analysis'
      ],
      'Economics': [
        'Demand and Supply', 'Business Cycles', 'Monetary Policy',
        'Fiscal Policy', 'International Trade', 'Currency Exchange'
      ],
      'Financial Reporting': [
        'Financial Statements', 'Revenue Recognition', 'Inventories',
        'Long-term Assets', 'Taxes', 'Long-term Liabilities', 'Equity'
      ],
      'Corporate Finance': [
        'Capital Budgeting', 'Cost of Capital', 'Leverage',
        'Dividends and Share Repurchases', 'Corporate Governance'
      ],
      'Equity Investments': [
        'Market Organisation', 'Security Market Indexes', 'Equity Valuation',
        'Industry Analysis', 'Company Analysis'
      ],
      'Fixed Income': [
        'Bond Features', 'Bond Valuation', 'Yield Measures',
        'Duration and Convexity', 'Credit Risk'
      ],
      'Derivatives': [
        'Derivative Markets', 'Forward Markets', 'Futures Markets',
        'Options Markets', 'Swaps'
      ],
      'Alternative Investments': [
        'Real Estate', 'Private Equity', 'Hedge Funds',
        'Commodities', 'Infrastructure'
      ],
      'Portfolio Management': [
        'Portfolio Risk and Return', 'Asset Allocation',
        'Basics of Portfolio Planning', 'Risk Management'
      ]
    }
  };

  // Generic fallback for unknown exam types
  return syllabuses[examType] || {
    'Core Subject': ['Fundamentals', 'Intermediate Concepts', 'Advanced Topics', 'Applications', 'Practice Problems']
  };
}
