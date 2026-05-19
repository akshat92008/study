import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';

// Standardized mapping weights
const MASTERY_WEIGHTS: Record<string, number> = {
  not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
};

function getMasteryLevel(score: number): 'not_started' | 'exposed' | 'developing' | 'proficient' | 'mastered' | 'automated' {
  if (score >= 95) return 'automated';
  if (score >= 85) return 'mastered';
  if (score >= 60) return 'proficient';
  if (score >= 25) return 'developing';
  if (score > 0) return 'exposed';
  return 'not_started';
}

// Chapter Syllabus recursive mapping
const CHAPTER_EXPANSIONS: Record<string, Array<{ topic: string, name: string }>> = {
  // Physics
  'Kinematics': [
    { topic: 'Vectors', name: 'Vector Algebra and Components' },
    { topic: 'Vectors', name: 'Dot and Cross Products' },
    { topic: 'Motion in 1D', name: 'Equations of Motion' },
    { topic: 'Motion in 2D', name: 'Projectile Motion' },
    { topic: 'Motion in 2D', name: 'Relative Velocity' },
  ],
  'Laws of Motion': [
    { topic: 'Forces', name: 'Newton\'s Laws of Motion' },
    { topic: 'Forces', name: 'Friction and Friction Coefficients' },
    { topic: 'Circular Motion', name: 'Banking of Roads and Centripetal Force' },
  ],
  'Work, Energy and Power': [
    { topic: 'Work & Kinetic Energy', name: 'Work-Energy Theorem' },
    { topic: 'Potential Energy', name: 'Conservative and Non-conservative Forces' },
    { topic: 'Power & Collisions', name: 'Elastic and Inelastic Collisions' },
  ],
  // Chemistry
  'Some Basic Concepts of Chemistry': [
    { topic: 'Stoichiometry', name: 'Mole Concept and Molar Mass' },
    { topic: 'Stoichiometry', name: 'Empirical and Molecular Formulas' },
  ],
  'Structure of Atom': [
    { topic: 'Bohr Model', name: 'Hydrogen Spectrum and Quantum Numbers' },
    { topic: 'Quantum Mechanics', name: 'Heisenberg Uncertainty Principle' },
  ],
  // Biology
  'The Living World': [
    { topic: 'Taxonomy', name: 'Binomial Nomenclature' },
    { topic: 'Taxonomy', name: 'Taxonomic Hierarchy' },
  ],
};

// Prerequisite map between seeded micro-concepts
const PREREQUISITES_MAP: Record<string, string[]> = {
  'Projectile Motion': ['Vector Algebra and Components', 'Equations of Motion'],
  'Relative Velocity': ['Vector Algebra and Components'],
  'Newton\'s Laws of Motion': ['Vector Algebra and Components', 'Equations of Motion'],
  'Work-Energy Theorem': ['Newton\'s Laws of Motion', 'Equations of Motion'],
  'Banking of Roads and Centripetal Force': ['Newton\'s Laws of Motion'],
};

export async function getCognitionGraph(userId: string) {
  const supabase = await createClient();

  const [conceptsRes, linksRes] = await Promise.all([
    supabase.from('concepts').select('*').eq('user_id', userId).order('subject', { ascending: true }),
    supabase.from('concept_links').select('*').eq('user_id', userId)
  ]);

  const concepts = conceptsRes.data || [];
  const links = linksRes.data || [];

  // Deep Hierarchy Grouping: Subject -> Chapter -> Topic -> Concept
  const grouped: Record<string, Record<string, Record<string, any[]>>> = {};

  // Fetch corresponding FSRS stability curves for all concepts to calculate hybrid decay
  const { data: cards } = await supabase.from('revision_cards').select('concept_id, stability').eq('user_id', userId);
  const stabilityMap: Record<string, number> = {};
  if (cards) {
    cards.forEach(c => {
      if (c.concept_id && c.stability > 0) stabilityMap[c.concept_id] = c.stability;
    });
  }
  
  concepts.forEach((c: any) => {
    if (!grouped[c.subject]) grouped[c.subject] = {};
    if (!grouped[c.subject][c.chapter]) grouped[c.subject][c.chapter] = {};
    
    // Fallback if topic is empty
    const topic = c.topic || 'General';
    if (!grouped[c.subject][c.chapter][topic]) grouped[c.subject][c.chapter][topic] = [];
    
    // Hybrid Decay Engine: Incorporate chronological time decay and FSRS stability metrics
    if (c.last_reviewed_at) {
      const daysElapsed = (Date.now() - new Date(c.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24);
      const stability = stabilityMap[c.id];
      
      if (stability) {
        // FSRS Forgetting Equation: R = exp(ln(0.9) * D / S)
        const retention = Math.exp(Math.log(0.9) * daysElapsed / stability);
        c.live_forgetting_probability = Math.min(0.99, Math.max(0, 1 - retention));
      } else {
        // Chronological Ebbinghaus Decay
        c.live_forgetting_probability = Math.min(0.99, Math.max(0, 1 - (c.retention_strength * Math.exp(-0.1 * daysElapsed))));
      }
    } else {
      c.live_forgetting_probability = 1.0;
    }

    grouped[c.subject][c.chapter][topic].push(c);
  });

  // Calculate global stats
  const total = concepts.length;
  const mastered = concepts.filter((c: any) => c.mastery === 'mastered' || c.mastery === 'automated').length;
  const developing = concepts.filter((c: any) => c.mastery === 'developing').length;
  const weak = concepts.filter((c: any) => c.mastery === 'exposed' || c.mastery === 'not_started').length;
  
  let overallMastery = 0;
  if (total > 0) {
    const sum = concepts.reduce((acc: number, c: any) => acc + (MASTERY_WEIGHTS[c.mastery] || 0), 0);
    overallMastery = Math.round(sum / total);
  }

  const stats = {
    total,
    mastered,
    developing,
    weak,
    overallMastery,
  };

  // Detect Weak Clusters (Chapters where avg mastery < 40%)
  const weakClusters: Array<{ subject: string, chapter: string, mastery: number }> = [];
  for (const subject in grouped) {
    for (const chapter in grouped[subject]) {
      let chapterSum = 0;
      let chapterTotal = 0;
      for (const topic in grouped[subject][chapter]) {
        grouped[subject][chapter][topic].forEach(c => {
          chapterSum += MASTERY_WEIGHTS[c.mastery] || 0;
          chapterTotal++;
        });
      }
      const avg = chapterTotal > 0 ? chapterSum / chapterTotal : 0;
      if (avg < 40) {
        weakClusters.push({ subject, chapter, mastery: Math.round(avg) });
      }
    }
  }

  return {
    concepts: concepts || [],
    links: links || [],
    grouped,
    stats,
    weakClusters,
  };
}

// Deep Syllabus Recursive Seeding Engine
export async function seedConceptsForSubject(userId: string, subject: string, chapters: string[]) {
  const supabase = await createClient();
  const conceptRows: any[] = [];
  const chaptersToExpand: string[] = [];

  chapters.forEach((chapter) => {
    const expansions = CHAPTER_EXPANSIONS[chapter];
    if (expansions && expansions.length > 0) {
      expansions.forEach((exp) => {
        conceptRows.push({
          user_id: userId,
          name: exp.name,
          subject,
          chapter,
          topic: exp.topic,
          mastery: 'not_started',
          confidence: 'low',
          times_reviewed: 0,
          times_correct: 0,
          times_incorrect: 0,
          forgetting_probability: 1.0,
          retention_strength: 0.0,
        });
      });
    } else {
      // Mark for dynamic expansion if not in hardcoded list
      chaptersToExpand.push(chapter);
    }
  });

  let insertedCount = 0;

  if (conceptRows.length > 0) {
    const { data: inserted, error } = await supabase.from('concepts').insert(conceptRows).select();
    if (error || !inserted) {
      logger.error('Failed to seed subject concepts', { error });
      throw error || new Error('Seeding failed');
    }
    insertedCount += inserted.length;

    // Auto-generate prerequisite dependency links inside concept_links
    const conceptMap: Record<string, string> = {};
    inserted.forEach((c: any) => {
      conceptMap[c.name] = c.id;
    });

    const linkRows: any[] = [];
    inserted.forEach((c: any) => {
      const prereqs = PREREQUISITES_MAP[c.name];
      if (prereqs) {
        prereqs.forEach((prereqName) => {
          const sourceId = conceptMap[prereqName];
          if (sourceId) {
            linkRows.push({
              user_id: userId,
              source_concept_id: sourceId,
              target_concept_id: c.id,
              link_type: 'prerequisite',
              strength: 0.8,
            });
          }
        });
      }
    });

    if (linkRows.length > 0) {
      await supabase.from('concept_links').insert(linkRows);
    }
  }

  // Handle dynamic AI expansion
  for (const chapter of chaptersToExpand) {
    try {
      const expandedConcepts = await expandChapterViaMind(userId, subject, chapter);
      if (expandedConcepts) {
        insertedCount += expandedConcepts.length;
      }
    } catch (e) {
      logger.error(`Failed to expand chapter ${chapter}`, { error: e });
      // Fallback
      await supabase.from('concepts').insert({
        user_id: userId,
        name: chapter,
        subject,
        chapter,
        topic: 'General',
        mastery: 'not_started',
        confidence: 'low',
        times_reviewed: 0,
        times_correct: 0,
        times_incorrect: 0,
        forgetting_probability: 1.0,
        retention_strength: 0.0,
      });
      insertedCount++;
    }
  }

  logger.info(`Recursively seeded ${insertedCount} micro-concepts and established prerequisite dependencies`, { userId, subject });
  return { seeded: insertedCount };
}

// Unified State Updater Recalculating Local, Chapter, and Prerequisite nodes
export async function updateConceptState(conceptId: string, correct: boolean, timeSpent: number) {
  const supabase = await createClient();

  const { data: concept } = await supabase.from('concepts').select('*').eq('id', conceptId).single();
  if (!concept) return;

  const newReviewed = (concept.times_reviewed || 0) + 1;
  const newCorrect = (concept.times_correct || 0) + (correct ? 1 : 0);
  const newIncorrect = (concept.times_incorrect || 0) + (correct ? 0 : 1);
  const accuracy = newCorrect / newReviewed;

  // mastery level mapping
  const newMastery = getMasteryLevel(accuracy * 100);

  // Chronological Ebbinghaus variables
  const now = new Date();
  const daysSinceReview = concept.last_reviewed_at
    ? (Date.now() - new Date(concept.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const retentionStrength = Math.min(1, accuracy * (newReviewed / 10));
  const forgettingProbability = Math.max(0, 1 - retentionStrength * Math.exp(-0.1 * daysSinceReview));

  await supabase.from('concepts').update({
    times_reviewed: newReviewed,
    times_correct: newCorrect,
    times_incorrect: newIncorrect,
    mastery: newMastery,
    confidence: accuracy >= 0.8 ? 'high' : accuracy >= 0.5 ? 'medium' : 'low',
    last_reviewed_at: now.toISOString(),
    retention_strength: retentionStrength,
    forgetting_probability: forgettingProbability,
    updated_at: now.toISOString(),
  }).eq('id', conceptId);

  // Recalculate and update strengths of prerequisite links where concept is target
  const { data: inboundLinks } = await supabase.from('concept_links').select('*').eq('target_concept_id', conceptId);
  if (inboundLinks && inboundLinks.length > 0) {
    const linkUpdates = inboundLinks.map((l: any) => {
      // If student was correct, the dependency was successfully recalled (boost strength)
      // If incorrect, the link strength decays representing a fragile dependency chain
      const newStrength = correct 
        ? Math.min(1.0, l.strength + 0.05) 
        : Math.max(0.1, l.strength - 0.15);

      return supabase.from('concept_links').update({ strength: newStrength }).eq('id', l.id);
    });
    
    await Promise.all(linkUpdates);
  }

  logger.info('Concept Graph State Updated', { conceptId, correct, newMastery, accuracy });
}

// Backward-compatible alias for existing callers
export async function updateConceptMastery(conceptId: string, correct: boolean, timeSpent: number) {
  return updateConceptState(conceptId, correct, timeSpent);
}

// AI analysis of cognition state
export async function analyzeCognitionState(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  const { concepts, stats } = await getCognitionGraph(userId);
  if (concepts.length === 0) return null;

  const weakConcepts = concepts
    .filter((c: any) => c.mastery === 'not_started' || c.mastery === 'exposed')
    .map((c: any) => `${c.subject}: ${c.chapter}`)
    .slice(0, 10);

  const prompt = `Analyze this student's knowledge state and provide strategic insights:

Exam: ${examType}
Overall Mastery: ${stats.overallMastery}%
Total Concepts: ${stats.total}
Mastered: ${stats.mastered}
Developing: ${stats.developing}
Weak/Not Started: ${stats.weak}

Weak areas: ${weakConcepts.join(', ')}

Respond as JSON:
{
  "summary": "2-3 sentence overall assessment",
  "topPriority": "single most important thing to focus on",
  "strengths": ["list of 2-3 strengths"],
  "criticalGaps": ["list of 2-3 critical gaps"],
  "recommendation": "specific actionable advice for today"
}`;

  return generateJSON('flash', `You are an expert ${examType} exam strategist.`, prompt);
}

// AI-Powered Dynamic Concept Expansion
export async function expandChapterViaMind(userId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  const prompt = `Break down the chapter "${chapter}" (${subject}) into 3-7 essential micro-concepts.
  For each, identify prerequisites from other chapters if any.
  
  Respond as JSON:
  {
    "concepts": [
      { "name": "Concept Name", "topic": "Parent Topic", "prerequisites": ["Other Concept Name"] }
    ]
  }`;
  
  const result = await generateJSON<{
    concepts: { name: string; topic: string; prerequisites: string[] }[];
  }>('flash', 'Expert curriculum designer.', prompt);
  
  const insertedConcepts = [];

  // Insert concepts and auto-link prerequisites
  for (const concept of result.concepts) {
    const { data } = await supabase.from('concepts').insert({
      user_id: userId,
      name: concept.name,
      subject,
      chapter,
      topic: concept.topic,
      mastery: 'not_started',
      confidence: 'low',
    }).select().single();
    
    if (data) {
      insertedConcepts.push(data);
      
      // Resolve and link prerequisites
      if (concept.prerequisites && concept.prerequisites.length > 0) {
        for (const prereq of concept.prerequisites) {
          const { resolveConceptByName } = await import('@/lib/engines/concept-resolver');
          const sourceId = await resolveConceptByName(userId, subject, prereq);
          
          if (sourceId) {
            await supabase.from('concept_links').insert({
              user_id: userId,
              source_concept_id: sourceId,
              target_concept_id: data.id,
              link_type: 'prerequisite',
              strength: 0.7,
            });
          }
        }
      }
    }
  }
  
  return insertedConcepts;
}

export async function getPrerequisiteChain(conceptId: string) {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from('concept_links')
    .select('source_concept_id')
    .eq('target_concept_id', conceptId)
    .eq('link_type', 'prerequisite');
  
  if (!links || links.length === 0) return [];
  
  const sourceIds = links.map((l: any) => l.source_concept_id);
  
  const { data: concepts } = await supabase
    .from('concepts')
    .select('name, mastery')
    .in('id', sourceIds);
    
  return (concepts || []).filter((c: any) => ['not_started', 'exposed', 'developing'].includes(c.mastery));
}
