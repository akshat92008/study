import type { DeterministicTutorQuestion } from './question-engine';

export type AnswerScore = 'correct' | 'partial' | 'incorrect';

export type EvaluateAnswerInput = {
  question: string;
  expectedAnswerPoints: string[];
  userAnswer: string;
  conceptTags: string[];
  chapterSlug: string;
  goalId?: string | null;
  missionId?: string | null;
  microtargetId?: string | null;
  taxonomyPath?: any;
  errorPatterns?: any[];
};

export type StructuredAnswerEvaluation = {
  score: AnswerScore;
  numericScore: number;
  matchedPoints: string[];
  missingPoints: string[];
  misconceptions: string[];
  feedback: string;
  nextAction: 'advance' | 'repair' | 'repeat';
  taxonomyPath?: any;
  conceptTags: string[];
  detectedErrorPatterns?: any[];
  weakAreaCandidate?: any;
};

const SYNONYMS: Array<[RegExp, string[]]> = [
  [/origin of replication/i, ['origin of replication', 'replication origin', 'ori']],
  [/starts replication/i, ['starts replication', 'initiates replication', 'begin replication']],
  [/controls copy number/i, ['controls copy number', 'copy number', 'number of copies']],
  [/negatively charged/i, ['negative charge', 'negatively charged', 'negative dna']],
  [/phosphate backbone/i, ['phosphate backbone', 'phosphate group', 'phosphates']],
  [/positive electrode|anode/i, ['positive electrode', 'positive pole', 'anode']],
  [/thermostable/i, ['thermostable', 'heat stable', 'temperature resistant']],
  [/high.temperature denaturation/i, ['high temperature', 'high heat', 'denaturation temperature']],
  [/extends primers/i, ['extends primers', 'primer extension', 'synthesizes dna']],
  [/identifies transformants/i, ['identify transformants', 'select transformants', 'find transformants']],
  [/eliminates non.transformants/i, ['eliminate non transformants', 'remove non transformants', 'kills non transformants']],
  [/antigen.antibody interaction/i, ['antigen antibody interaction', 'antigen antibody reaction', 'antibody antigen']],
  [/meloidogyne incognita/i, ['meloidogyne incognita']],
  [/denaturation/i, ['denaturation']],
  [/annealing/i, ['annealing', 'primer binding']],
  [/extension/i, ['extension', 'elongation']],
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function pointMatches(point: string, answer: string): boolean {
  const normalizedPoint = normalize(point);
  const normalizedAnswer = normalize(answer);
  const synonym = SYNONYMS.find(([pattern]) => pattern.test(point));
  if (synonym) return synonym[1].some((candidate) => normalizedAnswer.includes(normalize(candidate)));

  const meaningful = normalizedPoint.split(' ').filter((word) => word.length >= 4);
  if (meaningful.length === 0) return normalizedAnswer.includes(normalizedPoint);
  const hits = meaningful.filter((word) => normalizedAnswer.includes(word)).length;
  return hits / meaningful.length >= 0.6;
}

function conciseMissing(point: string): string {
  return point.replace(/^the\s+/i, '').replace(/[.]$/, '');
}

export function evaluateAnswer(input: EvaluateAnswerInput): StructuredAnswerEvaluation {
  const answer = input.userAnswer.trim();
  const matchedPoints = input.expectedAnswerPoints.filter((point) => pointMatches(point, answer));
  const missingPoints = input.expectedAnswerPoints.filter((point) => !matchedPoints.includes(point));
  const numericScore = input.expectedAnswerPoints.length === 0
    ? 0
    : Number((matchedPoints.length / input.expectedAnswerPoints.length).toFixed(2));
  const score: AnswerScore = numericScore >= 0.8
    ? 'correct'
    : numericScore > 0
      ? 'partial'
      : 'incorrect';

  const misconceptions: string[] = [];
  const normalizedAnswer = normalize(answer);
  if (input.conceptTags.includes('ori') && /only\s+(starts|begins)/.test(normalizedAnswer)) {
    misconceptions.push('ori also controls the copy number of linked DNA');
  }
  if (input.conceptTags.includes('dna_charge') && /dna\s+is\s+positive/.test(normalizedAnswer)) {
    misconceptions.push('DNA is negatively charged because of its phosphate backbone');
  }

  const detectedErrorPatterns = [];
  if (input.errorPatterns) {
    for (const ep of input.errorPatterns) {
      if (normalizedAnswer.includes(normalize(ep.trigger.split(' ')[0]))) { // simplistic match for now
        detectedErrorPatterns.push(ep);
        misconceptions.push(ep.feedback);
      }
    }
  }

  let feedback = score === 'correct'
    ? `Correct. ${matchedPoints.join('; ')}.`
    : score === 'partial'
      ? `Partial. You included ${matchedPoints.map(conciseMissing).join('; ')}, but also remember ${missingPoints.map(conciseMissing).join('; ')}.`
      : `Not yet. The key points are ${input.expectedAnswerPoints.map(conciseMissing).join('; ')}.`;
      
  if (misconceptions.length > 0) {
    feedback += ` Note: ${misconceptions[0]}`;
  }

  let weakAreaCandidate = null;
  if (score !== 'correct') {
    const defaultSeverity = score === 'incorrect' ? 'high' : 'medium';
    const ep = detectedErrorPatterns.length > 0 ? detectedErrorPatterns[0] : null;
    
    if (input.taxonomyPath) {
      weakAreaCandidate = {
        subject: input.taxonomyPath.subject,
        unitSlug: input.taxonomyPath.unitSlug,
        chapterSlug: input.taxonomyPath.chapterSlug,
        topicSlug: input.taxonomyPath.topicSlug,
        subtopicSlug: input.taxonomyPath.subtopicSlug,
        conceptSlug: input.taxonomyPath.conceptSlug,
        microskillSlug: input.taxonomyPath.microskillSlug,
        errorPatternSlug: ep ? ep.slug : undefined,
        displayPath: [
          input.taxonomyPath.chapterSlug?.replace(/-/g, ' '),
          input.taxonomyPath.topicSlug?.replace(/-/g, ' '),
          input.taxonomyPath.subtopicSlug?.replace(/-/g, ' '),
          input.taxonomyPath.conceptSlug?.replace(/-/g, ' '),
          input.taxonomyPath.microskillSlug?.replace(/-/g, ' ')
        ].filter(Boolean),
        severity: ep ? ep.severity : defaultSeverity,
        missingPoints,
        recommendedAction: `Revise ${input.taxonomyPath.conceptSlug?.replace(/-/g, ' ') || input.chapterSlug} essentials.`
      };
    } else {
      weakAreaCandidate = {
        subject: '',
        unitSlug: '',
        chapterSlug: input.chapterSlug,
        topicSlug: input.chapterSlug,
        displayPath: [input.chapterSlug.replace(/-/g, ' ')],
        severity: defaultSeverity,
        missingPoints,
        recommendedAction: `Revise ${input.chapterSlug} basics.`
      };
    }
  }

  return {
    score,
    numericScore,
    matchedPoints,
    missingPoints,
    misconceptions,
    feedback,
    nextAction: score === 'correct' ? 'advance' : score === 'partial' ? 'repair' : 'repeat',
    taxonomyPath: input.taxonomyPath,
    conceptTags: input.conceptTags,
    detectedErrorPatterns,
    weakAreaCandidate
  };
}

export function nextMasteryState(input: {
  score: AnswerScore;
  currentScore?: number | null;
  correctCount?: number | null;
  partialCount?: number | null;
  incorrectCount?: number | null;
}) {
  const correctCount = (input.correctCount ?? 0) + (input.score === 'correct' ? 1 : 0);
  const partialCount = (input.partialCount ?? 0) + (input.score === 'partial' ? 1 : 0);
  const incorrectCount = (input.incorrectCount ?? 0) + (input.score === 'incorrect' ? 1 : 0);
  const delta = input.score === 'correct' ? 0.2 : input.score === 'partial' ? 0.04 : -0.12;
  const masteryScore = Math.max(0, Math.min(1, Number(((input.currentScore ?? 0) + delta).toFixed(2))));
  return { masteryScore, correctCount, partialCount, incorrectCount };
}

export async function persistAnswerEvaluation(input: {
  supabase: any;
  userId: string;
  question: any; // DeterministicTutorQuestion
  userAnswer: string;
  evaluation: StructuredAnswerEvaluation;
  chapterSlug: string;
  goalId: string;
  missionId?: string | null;
  microtargetId?: string | null;
}) {
  const { data: attempt, error: attemptError } = await input.supabase
    .from('tutor_question_attempts')
    .insert({
      user_id: input.userId,
      goal_id: input.goalId,
      mission_id: input.missionId ?? null,
      microtarget_id: input.microtargetId ?? null,
      question_id: input.question.questionId,
      question: input.question.question,
      question_text: input.question.question,
      expected_answer_points: input.question.expectedAnswerPoints,
      user_answer: input.userAnswer,
      evaluation_result: input.evaluation.score,
      score: input.evaluation.score,
      numeric_score: input.evaluation.numericScore,
      matched_points: input.evaluation.matchedPoints,
      missing_points: input.evaluation.missingPoints,
      misconceptions: input.evaluation.misconceptions,
      concept_tags: input.question.conceptTags,
      ai_feedback: input.evaluation.feedback,
      taxonomy_path: input.evaluation.taxonomyPath ?? null,
      error_patterns: input.evaluation.detectedErrorPatterns ?? null,
    })
    .select('id')
    .single();
  if (attemptError) throw attemptError;

  await input.supabase.from('learning_events').insert({
    user_id: input.userId,
    goal_id: input.goalId,
    event_type: 'tutor_answer_evaluated',
    concept_tags: input.question.conceptTags,
    payload: {
      questionId: input.question.questionId,
      attemptId: attempt?.id ?? null,
      score: input.evaluation.score,
      numericScore: input.evaluation.numericScore,
      missingPoints: input.evaluation.missingPoints,
    },
  });

  const tp = input.evaluation.taxonomyPath;
  const wac = input.evaluation.weakAreaCandidate;

  // Enforce Mapping: Unmapped attempts do not update mastery or weak areas
  if (!tp) {
    return { attemptId: attempt?.id ?? null };
  }

  // Persist concept mastery
  // We can track this at the concept level or microskill level. We will use microskill if present, else concept.
  const granularSlug = tp.microskillSlug || tp.conceptSlug || 'general';
  
  const { data: existing } = await input.supabase
    .from('concept_mastery')
    .select('id, mastery_score, correct_count, partial_count, incorrect_count')
    .eq('user_id', input.userId)
    .eq('goal_id', input.goalId)
    .eq('chapter_slug', input.chapterSlug)
    .eq('topic_slug', tp.topicSlug || input.chapterSlug)
    .eq('subtopic_slug', tp.subtopicSlug || '')
    .eq('concept_slug', tp.conceptSlug || '')
    .eq('microskill_slug', tp.microskillSlug || '')
    .maybeSingle();

  const next = nextMasteryState({
    score: input.evaluation.score,
    currentScore: existing?.mastery_score,
    correctCount: existing?.correct_count,
    partialCount: existing?.partial_count,
    incorrectCount: existing?.incorrect_count,
  });

  await input.supabase.from('concept_mastery').upsert({
    id: existing?.id,
    user_id: input.userId,
    goal_id: input.goalId,
    subject: tp.subject || '',
    unit_slug: tp.unitSlug || '',
    chapter_slug: input.chapterSlug,
    topic_slug: tp.topicSlug || input.chapterSlug,
    subtopic_slug: tp.subtopicSlug || '',
    concept_slug: tp.conceptSlug || '',
    microskill_slug: tp.microskillSlug || '',
    concept_tag: input.question.conceptTags[0] || 'general',
    mastery_score: next.masteryScore,
    correct_count: next.correctCount,
    partial_count: next.partialCount,
    incorrect_count: next.incorrectCount,
    last_practiced_at: new Date().toISOString(),
    last_result: input.evaluation.score,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,goal_id,chapter_slug,topic_slug,subtopic_slug,concept_slug,microskill_slug' });

  // Handle weak areas
  if (wac) {
    const failures = next.partialCount + next.incorrectCount;
    // Upgrade severity on repeated incorrect
    let currentSeverity = wac.severity;
    if (failures >= 2 && currentSeverity !== 'urgent') {
      currentSeverity = 'high';
    }
    if (failures >= 3) {
      currentSeverity = 'urgent';
    }

    await input.supabase.from('weak_area_events').insert({
      user_id: input.userId,
      goal_id: input.goalId,
      subject: wac.subject,
      unit_slug: wac.unitSlug,
      chapter_slug: wac.chapterSlug,
      topic_slug: wac.topicSlug,
      subtopic_slug: wac.subtopicSlug,
      concept_slug: wac.conceptSlug,
      microskill_slug: wac.microskillSlug,
      error_pattern_slug: wac.errorPatternSlug,
      concept_tag: input.question.conceptTags[0] || 'general',
      severity: currentSeverity,
      attempt_id: attempt?.id ?? null,
      source_question_id: attempt?.id ?? null,
      missing_points: wac.missingPoints,
      misconception_notes: input.evaluation.misconceptions,
      display_path: wac.displayPath,
      recommended_action: wac.recommendedAction,
      confidence: 0.8,
      evidence_count: failures || 1
    });
  } else if (next.correctCount >= 2) {
    // Resolve previous weak areas for this granular path
    await input.supabase
      .from('weak_area_events')
      .update({ resolved_at: new Date().toISOString() })
      .eq('user_id', input.userId)
      .eq('goal_id', input.goalId)
      .eq('chapter_slug', input.chapterSlug)
      .eq('topic_slug', tp.topicSlug || input.chapterSlug)
      .eq('subtopic_slug', tp.subtopicSlug || '')
      .eq('concept_slug', tp.conceptSlug || '')
      .eq('microskill_slug', tp.microskillSlug || '')
      .is('resolved_at', null);
  }

  return { attemptId: attempt?.id ?? null };
}

