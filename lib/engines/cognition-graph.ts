import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';

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

const CHAPTER_EXPANSIONS: Record<string, Array<{ topic: string, name: string }>> = {
  'Kinematics': [
    { topic: 'Vectors', name: 'Vector Addition & Subtraction' }, { topic: 'Vectors', name: 'Dot and Cross Products' },
    { topic: '1D Motion', name: 'Equations of Motion' }, { topic: '1D Motion', name: 'Free Fall' },
    { topic: '2D Motion', name: 'Projectile Motion' }, { topic: '2D Motion', name: 'Relative Velocity' },
  ],
  'Laws of Motion': [
    { topic: 'Forces', name: 'Newton\'s First Law (Inertia)' }, { topic: 'Forces', name: 'Newton\'s Second Law (F=ma)' },
    { topic: 'Forces', name: 'Newton\'s Third Law' }, { topic: 'Friction', name: 'Static & Kinetic Friction' },
    { topic: 'Circular', name: 'Centripetal Force' }, { topic: 'Circular', name: 'Banking of Roads' },
  ],
  'Thermodynamics': [
    { topic: 'Laws', name: 'Zeroth Law & Temp' }, { topic: 'Laws', name: 'First Law & Internal Energy' },
    { topic: 'Processes', name: 'Isothermal & Adiabatic' }, { topic: 'Processes', name: 'Carnot Engine' },
  ],
  'Electrostatics': [
    { topic: 'Charge', name: 'Coulomb\'s Law' }, { topic: 'Field', name: 'Electric Field & Flux' },
    { topic: 'Potential', name: 'Gauss\'s Law' }, { topic: 'Capacitance', name: 'Capacitors in Series/Parallel' },
  ],
  'Cell: The Unit of Life': [
    { topic: 'Structure', name: 'Plasma Membrane' }, { topic: 'Structure', name: 'Cell Wall' },
    { topic: 'Organelles', name: 'Mitochondria & Chloroplasts' }, { topic: 'Organelles', name: 'Endomembrane System' },
  ],
  'Human Reproduction': [
    { topic: 'Male', name: 'Male Reproductive System' }, { topic: 'Female', name: 'Female Reproductive System' },
    { topic: 'Process', name: 'Gametogenesis' }, { topic: 'Process', name: 'Menstrual Cycle' },
  ],
  'Genetics': [
    { topic: 'Mendelian', name: 'Laws of Inheritance' }, { topic: 'Mendelian', name: 'Incomplete Dominance' },
    { topic: 'Molecular', name: 'DNA Structure' }, { topic: 'Molecular', name: 'Transcription & Translation' },
  ]
};

const PREREQUISITES_MAP: Record<string, string[]> = {
  'Projectile Motion': ['Vector Addition & Subtraction', 'Equations of Motion'],
  'Relative Velocity': ['Vector Addition & Subtraction'],
  'Newton\'s Laws of Motion': ['Vector Addition & Subtraction', 'Equations of Motion'],
  'Work-Energy Theorem': ['Newton\'s Second Law (F=ma)', 'Equations of Motion'],
  'Banking of Roads': ['Newton\'s Second Law (F=ma)'],
};

export async function getCognitionGraph(userId: string) {
  const supabase = await createClient();

  const [conceptsRes, linksRes] = await Promise.all([
    supabase.from('concepts').select('*').eq('user_id', userId).order('subject', { ascending: true }),
    supabase.from('concept_links').select('*').eq('user_id', userId)
  ]);

  const concepts = conceptsRes.data || [];
  const links = linksRes.data || [];

  const grouped: Record<string, Record<string, Record<string, any[]>>> = {};

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
    
    const topic = c.topic || 'General';
    if (!grouped[c.subject][c.chapter][topic]) grouped[c.subject][c.chapter][topic] = [];
    
    if (c.last_reviewed_at) {
      const daysElapsed = (Date.now() - new Date(c.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24);
      const stability = stabilityMap[c.id];
      
      if (stability) {
        const retention = Math.exp(Math.log(0.9) * daysElapsed / stability);
        c.live_forgetting_probability = Math.min(0.99, Math.max(0, 1 - retention));
      } else {
        c.live_forgetting_probability = Math.min(0.99, Math.max(0, 1 - (c.retention_strength * Math.exp(-0.1 * daysElapsed))));
      }
    } else {
      c.live_forgetting_probability = 1.0;
    }

    grouped[c.subject][c.chapter][topic].push(c);
  });

  const total = concepts.length;
  const mastered = concepts.filter((c: any) => c.mastery === 'mastered' || c.mastery === 'automated').length;
  const developing = concepts.filter((c: any) => c.mastery === 'developing').length;
  const weak = concepts.filter((c: any) => c.mastery === 'exposed' || c.mastery === 'not_started').length;
  
  let overallMastery = 0;
  if (total > 0) {
    const sum = concepts.reduce((acc: number, c: any) => acc + (MASTERY_WEIGHTS[c.mastery] || 0), 0);
    overallMastery = Math.round(sum / total);
  }

  const stats = { total, mastered, developing, weak, overallMastery };

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

  return { concepts: concepts || [], links: links || [], grouped, stats, weakClusters };
}

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
      chaptersToExpand.push(chapter);
    }
  });

  let insertedCount = 0;

  if (conceptRows.length > 0) {
    const { data: inserted, error } = await supabase.from('concepts').insert(conceptRows).select();
    if (error || !inserted) throw error || new Error('Seeding failed');
    insertedCount += inserted.length;

    const conceptMap: Record<string, string> = {};
    inserted.forEach((c: any) => { conceptMap[c.name] = c.id; });

    const linkRows: any[] = [];
    inserted.forEach((c: any) => {
      const prereqs = PREREQUISITES_MAP[c.name];
      if (prereqs) {
        prereqs.forEach((prereqName) => {
          const sourceId = conceptMap[prereqName];
          if (sourceId) {
            linkRows.push({
              user_id: userId, source_concept_id: sourceId, target_concept_id: c.id, link_type: 'prerequisite', strength: 0.8,
            });
          }
        });
      }
    });

    if (linkRows.length > 0) await supabase.from('concept_links').insert(linkRows);
  }

  for (const chapter of chaptersToExpand) {
    try {
      const expandedConcepts = await expandChapterViaMind(userId, subject, chapter);
      if (expandedConcepts) insertedCount += expandedConcepts.length;
    } catch (e) {
      await supabase.from('concepts').insert({
        user_id: userId, name: chapter, subject, chapter, topic: 'General',
        mastery: 'not_started', confidence: 'low', times_reviewed: 0, times_correct: 0,
        times_incorrect: 0, forgetting_probability: 1.0, retention_strength: 0.0,
      });
      insertedCount++;
    }
  }

  return { seeded: insertedCount };
}

export async function updateConceptState(conceptId: string, correct: boolean, timeSpent: number) {
  const supabase = await createClient();

  const { data: concept } = await supabase.from('concepts').select('*').eq('id', conceptId).single();
  if (!concept) return;

  const newReviewed = (concept.times_reviewed || 0) + 1;
  const newCorrect = (concept.times_correct || 0) + (correct ? 1 : 0);
  const newIncorrect = (concept.times_incorrect || 0) + (correct ? 0 : 1);
  const accuracy = newCorrect / newReviewed;

  const newMastery = getMasteryLevel(accuracy * 100);

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

  const { data: inboundLinks } = await supabase.from('concept_links').select('*').eq('target_concept_id', conceptId);
  if (inboundLinks && inboundLinks.length > 0) {
    const linkUpdates = inboundLinks.map((l: any) => {
      const newStrength = correct ? Math.min(1.0, l.strength + 0.05) : Math.max(0.1, l.strength - 0.15);
      return supabase.from('concept_links').update({ strength: newStrength }).eq('id', l.id);
    });
    await Promise.all(linkUpdates);
  }
}

export async function updateConceptMastery(conceptId: string, correct: boolean, timeSpent: number) {
  return updateConceptState(conceptId, correct, timeSpent);
}

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
Weak areas: ${weakConcepts.join(', ')}

Respond as JSON: { "summary": "assessment", "topPriority": "focus", "strengths": ["s1"], "criticalGaps": ["g1"], "recommendation": "advice" }`;

  return generateJSON('flash', `You are an expert ${examType} exam strategist.`, prompt);
}

export async function expandChapterViaMind(userId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  const prompt = `Break down the chapter "${chapter}" (${subject}) into 3-7 essential micro-concepts. Respond as JSON: { "concepts": [ { "name": "Concept", "topic": "Parent", "prerequisites": ["Other Concept"] } ] }`;
  
  const result = await generateJSON<any>('flash', 'Expert curriculum designer.', prompt);
  const insertedConcepts = [];

  for (const concept of result.concepts) {
    const { data } = await supabase.from('concepts').insert({
      user_id: userId, name: concept.name, subject, chapter, topic: concept.topic, mastery: 'not_started', confidence: 'low',
    }).select().single();
    
    if (data) {
      insertedConcepts.push(data);
      if (concept.prerequisites && concept.prerequisites.length > 0) {
        for (const prereq of concept.prerequisites) {
          const { resolveConceptByName } = await import('@/lib/engines/concept-resolver');
          const sourceId = await resolveConceptByName(userId, subject, prereq);
          if (sourceId) {
            await supabase.from('concept_links').insert({
              user_id: userId, source_concept_id: sourceId, target_concept_id: data.id, link_type: 'prerequisite', strength: 0.7,
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
  const { data: links } = await supabase.from('concept_links').select('source_concept_id').eq('target_concept_id', conceptId).eq('link_type', 'prerequisite');
  if (!links || links.length === 0) return [];
  const sourceIds = links.map((l: any) => l.source_concept_id);
  const { data: concepts } = await supabase.from('concepts').select('name, mastery').in('id', sourceIds);
  return (concepts || []).filter((c: any) => ['not_started', 'exposed', 'developing'].includes(c.mastery));
}
