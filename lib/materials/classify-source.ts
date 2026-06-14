import { normalizeGoal, type NormalizedGoal } from '@/lib/goals/normalize-goal';

export type SourceClassification = {
  detectedSubject: string | null;
  detectedChapter: string | null;
  goalMatchScore: number;
  mismatch: boolean;
  warningMessage: string | null;
};

type ActiveGoalLike = {
  title?: string | null;
  subject?: string | null;
  metadata?: Record<string, any> | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function classifySource(input: {
  filename?: string | null;
  title?: string | null;
  firstPageText?: string | null;
  activeGoal?: ActiveGoalLike | null;
  normalizedGoal?: NormalizedGoal | null;
}): SourceClassification {
  const haystack = normalize([input.filename, input.title, input.firstPageText].filter(Boolean).join(' '));
  const goal = input.normalizedGoal
    ?? (input.activeGoal?.metadata?.normalizedGoal as NormalizedGoal | undefined)
    ?? normalizeGoal(input.activeGoal?.title ?? '');

  let detectedSubject: string | null = null;
  let detectedChapter: string | null = null;

  if (/\b(alternating current|current electricity|electrostatics|magnetism|physics|phy)\b/.test(haystack)) {
    detectedSubject = 'Physics';
    if (/\balternating current\b/.test(haystack) || /\b(ac circuit|ac current)\b/.test(haystack)) {
      detectedChapter = 'Alternating Current';
    }
  } else if (/\b(biotechnology|biotech|recombinant|r dna|pcr|plasmid|genetic engineering|bt cotton)\b/.test(haystack)) {
    detectedSubject = 'Biology';
    detectedChapter = 'Biotechnology';
  } else if (/\bchemistry|chemical bonding|electrochemistry|organic chemistry\b/.test(haystack)) {
    detectedSubject = 'Chemistry';
  } else if (/\bbiology|botany|zoology\b/.test(haystack)) {
    detectedSubject = 'Biology';
  }

  const goalSubject = goal.subject ?? input.activeGoal?.subject ?? null;
  const goalChapter = goal.chapter ?? goal.chapterSlug?.replace(/^neet-[a-z]+-/, '').replace(/-/g, ' ') ?? null;
  let goalMatchScore = 0.5;
  if (detectedSubject && goalSubject && normalize(detectedSubject) !== normalize(goalSubject)) {
    goalMatchScore = 0.05;
  } else if (detectedChapter && goalChapter && normalize(detectedChapter) === normalize(goalChapter)) {
    goalMatchScore = 0.98;
  } else if (detectedSubject && goalSubject && normalize(detectedSubject) === normalize(goalSubject)) {
    goalMatchScore = detectedChapter && goalChapter ? 0.75 : 0.7;
  }

  const mismatch = Boolean(detectedSubject && goalSubject && normalize(detectedSubject) !== normalize(goalSubject));
  return {
    detectedSubject,
    detectedChapter,
    goalMatchScore,
    mismatch,
    warningMessage: mismatch
      ? `This source looks like ${detectedSubject}${detectedChapter ? ` / ${detectedChapter}` : ''}, but your active goal is ${goalChapter ?? input.activeGoal?.title ?? goalSubject}. Attach anyway?`
      : null,
  };
}

