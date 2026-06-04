/**
 * SESSION CARD SELECTOR
 * =====================
 * Deterministic, explainable priority algorithm.
 * The LLM is only allowed to phrase the card — never to pick the target.
 *
 * Priority (evaluated in order, first match wins):
 *   P1  Due / overdue revision cards
 *   P2  Recent mistakes (last 7 days)
 *   P3  Active daily task (after urgent review/mistake signals)
 *   P4  Active LEARNING GOAL deadline pressure
 *   P5  Recently studied but low-mastery concepts
 *   P6  Weakest concepts  (mastery ∈ {not_started, exposed, developing})
 *   P7  Fallback / onboarding  (no learner data at all)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type SessionCardTaskType =
  | 'revision'        // P1: work overdue FSRS cards
  | 'mistake_repair'  // P2: autopsy-identified gap
  | 'concept_study'   // P3: weak atlas concept
  | 'goal_sprint'     // P4: deadline-driven topic
  | 'reinforcement'   // P5: recently studied but low mastery
  | 'onboarding';     // P6: no real learner state yet

export type SessionCardResourceType =
  | 'flashcard_review'
  | 'concept_video'
  | 'practice_questions'
  | 'reading'
  | 'onboarding_prompt';

export interface SelectorInput {
  /** User's Supabase profile */
  profile: {
    id: string;
    exam_type: string | null;
    target_date: string | null;
    streak_days: number;
    timezone: string | null;
    onboarding_complete: boolean;
  } | null;

  /** Active learning goal (first active goal only) */
  activeGoal: {
    id: string;
    title: string;
    target_date: string | null;
    progress: number;
  } | null;

  /** Overdue FSRS revision cards — count only (already fetched) */
  overdueCardCount: number;

  /**
   * The actual due card with highest priority (oldest due + hardest).
   * Null if overdueCardCount === 0.
   */
  topDueCard: {
    id: string;
    subject: string | null;
    chapter: string | null;
    concept_id: string | null;
    difficulty: number;
    lapses: number;
  } | null;

  /** Mistakes from last 7 days, most recent first */
  recentMistakes: Array<{
    id: string;
    subject: string | null;
    chapter: string | null;
    category: string;
    concept_id: string | null;
    created_at: string;
  }>;

  /** Concepts ordered by weakness (mastery asc, forgetting_probability desc) */
  weakConcepts: Array<{
    id: string;
    name: string;
    subject: string;
    chapter: string;
    mastery: string | null;
    mastery_score: number | null;
    forgetting_probability: number | null;
    times_reviewed: number | null;
  }>;

  /** Total session count (for dayNumber) */
  sessionCount: number;

  /** Optional student model */
  studentModel: {
    fatigue_threshold_minutes: number | null;
    peak_productivity_hour: number | null;
  } | null;

  /** Open COMMAND tasks for today, already ordered by orchestration priority. */
  commandOpenTasks?: Array<{
    title: string;
    type?: string | null;
    subject?: string | null;
    chapter?: string | null;
    estimated_minutes?: number | null;
    priority?: string | null;
    notes?: string | null;
  }>;

  /** Hermes memories from Autopsy. */
  hermesMemories?: Array<{
    id: string;
    concept: string;
    pattern: string;
    severity: string;
    action_type: string;
    subject?: string;
    topic?: string;
  }>;

  /** ISO timestamp of "now" (injectable for tests) */
  now?: string;
}

export interface SelectorOutput {
  /** The resolved concept UUID driving this card (null for onboarding) */
  targetConceptId: string | null;

  /** Priority bucket that was selected */
  priority: SessionCardTaskType;

  /** Human-readable reason for selection (deterministic) */
  reason: string;

  /** Estimated session duration in minutes */
  estimatedMinutes: number;

  taskType: SessionCardTaskType;
  resourceType: SessionCardResourceType;

  /** Subject for display */
  subject: string;

  /** Chapter / topic for display */
  topic: string;

  /** Mastery value before this session */
  masteryBefore: string | null;

  /** How many FSRS cards are due right now */
  dueCardCount: number;

  /** How many mistakes are in the recent window */
  mistakeCount: number;

  /** Hint for question targeting (may be empty string) */
  questionTarget: string;

  /** Hint for which revision card to target (may be empty string) */
  revisionTarget: string;

  /** True if user has no real data yet */
  needsOnboarding: boolean;

  /** Number of days to exam (null if no target date) */
  daysToExam: number | null;

  /** Whether user is currently in their peak hour */
  isPeakHour: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MISTAKE_WINDOW_DAYS = 7;
const DEFAULT_FOCUS_MINUTES = 45;

const MASTERY_LABEL_ORDER: Record<string, number> = {
  not_started: 0,
  exposed: 1,
  developing: 2,
  proficient: 3,
  mastered: 4,
  automated: 5,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(isoDate: string, now: Date): number {
  const target = new Date(isoDate);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

function masteryOrder(mastery: string | null): number {
  return MASTERY_LABEL_ORDER[mastery ?? 'not_started'] ?? 0;
}

// ─── Core selector ───────────────────────────────────────────────────────────

export function selectSessionCard(input: SelectorInput): SelectorOutput {
  const now = input.now ? new Date(input.now) : new Date();
  const focusMinutes =
    input.studentModel?.fatigue_threshold_minutes ?? DEFAULT_FOCUS_MINUTES;
  const peakHour = input.studentModel?.peak_productivity_hour ?? 10;
  const isPeakHour = Math.abs(now.getHours() - peakHour) <= 1;

  const daysToExam =
    input.profile?.target_date
      ? daysUntil(input.profile.target_date, now)
      : null;

  const examType = input.profile?.exam_type ?? input.activeGoal?.title ?? 'General Study';

  // ─── GUARD: No profile / onboarding incomplete ───────────────────────────
  if (!input.profile || !input.profile.onboarding_complete) {
    return {
      targetConceptId: null,
      priority: 'onboarding',
      reason: 'Complete your profile setup to receive a personalised daily card.',
      estimatedMinutes: 10,
      taskType: 'onboarding',
      resourceType: 'onboarding_prompt',
      subject: examType,
      topic: 'Profile Setup',
      masteryBefore: null,
      dueCardCount: input.overdueCardCount,
      mistakeCount: input.recentMistakes.length,
      questionTarget: '',
      revisionTarget: '',
      needsOnboarding: true,
      daysToExam,
      isPeakHour,
    };
  }

  // ─── P1: Due / overdue MEMORY cards ──────────────────────────────────────
  if (input.overdueCardCount > 0 && input.topDueCard) {
    const card = input.topDueCard;
    const lapseNote =
      card.lapses > 0 ? ` (${card.lapses} previous lapse${card.lapses > 1 ? 's' : ''})` : '';
    return {
      targetConceptId: card.concept_id,
      priority: 'revision',
      reason:
        `${input.overdueCardCount} revision card${input.overdueCardCount > 1 ? 's are' : ' is'} due for review${lapseNote}. ` +
        `Reviewing before learning new material maximises long-term retention.`,
      estimatedMinutes: Math.min(focusMinutes, Math.ceil(input.overdueCardCount * 1.2) + 5),
      taskType: 'revision',
      resourceType: 'flashcard_review',
      subject: card.subject ?? examType,
      topic: card.chapter ?? 'Flashcard Review',
      masteryBefore: null,
      dueCardCount: input.overdueCardCount,
      mistakeCount: input.recentMistakes.length,
      questionTarget: card.chapter ?? '',
      revisionTarget: card.id,
      needsOnboarding: false,
      daysToExam,
      isPeakHour,
    };
  }

  // ─── P2: Recent mistakes ─────────────────────────────────────────────────
  const cutoff = new Date(now.getTime() - MISTAKE_WINDOW_DAYS * 86_400_000);
  const freshMistakes = input.recentMistakes.filter(
    (m) => new Date(m.created_at) >= cutoff
  );

  if (freshMistakes.length > 0) {
    // Pick the mistake in the weakest chapter (by mistake frequency)
    const chapterCount: Record<string, number> = {};
    for (const m of freshMistakes) {
      const key = `${m.subject}::${m.chapter}`;
      chapterCount[key] = (chapterCount[key] ?? 0) + 1;
    }
    const topKey = Object.entries(chapterCount).sort((a, b) => b[1] - a[1])[0][0];
    const [topSubject, topChapter] = topKey.split('::');
    const topMistake = freshMistakes.find(
      (m) => m.subject === topSubject && m.chapter === topChapter
    )!;

    return {
      targetConceptId: topMistake.concept_id,
      priority: 'mistake_repair',
      reason:
        `${freshMistakes.length} recent mistake${freshMistakes.length > 1 ? 's' : ''} identified in Mistake Review. ` +
        `${topChapter} (${topSubject}) has the highest error rate — repair this gap now.`,
      estimatedMinutes: focusMinutes,
      taskType: 'mistake_repair',
      resourceType: 'practice_questions',
      subject: topSubject ?? examType,
      topic: topChapter ?? 'Mistake Recovery',
      masteryBefore: null,
      dueCardCount: input.overdueCardCount,
      mistakeCount: freshMistakes.length,
      questionTarget: topChapter ?? '',
      revisionTarget: '',
      needsOnboarding: false,
      daysToExam,
      isPeakHour,
    };
  }

  // ─── P2.5: Hermes Learning Memories ──────────────────────────────────────
  if (input.hermesMemories && input.hermesMemories.length > 0) {
    const memory = input.hermesMemories[0]; // Already ordered by severity and date in SQL
    return {
      targetConceptId: null, // Memories aren't strictly bound to a concept_id yet
      priority: 'mistake_repair', // Use same general task type as mistake repair
      reason: `Autopsy identified a recurring mistake pattern in ${memory.topic || memory.concept}: "${memory.pattern}". Fixing structural gaps here is high yield.`,
      estimatedMinutes: focusMinutes,
      taskType: 'mistake_repair',
      resourceType: 'practice_questions',
      subject: memory.subject ?? examType,
      topic: memory.topic ?? memory.concept,
      masteryBefore: null,
      dueCardCount: input.overdueCardCount,
      mistakeCount: input.recentMistakes.length,
      questionTarget: memory.topic ?? memory.concept,
      revisionTarget: '',
      needsOnboarding: false,
      daysToExam,
      isPeakHour,
    };
  }

  // ─── P3: Active plan task ────────────────────────────────────────────────
  const commandTask = input.commandOpenTasks?.find((task) => task.type !== 'break');
  if (commandTask) {
    const commandPriority = mapCommandTaskType(commandTask.type);
    return {
      targetConceptId: null,
      priority: commandPriority.taskType,
      reason:
        `Today's Mission selected "${commandTask.title}" from the active daily plan. ` +
        (commandTask.notes || 'This keeps today aligned with your latest learner-state evidence.'),
      estimatedMinutes: Math.min(
        focusMinutes,
        Math.max(10, Number(commandTask.estimated_minutes ?? focusMinutes))
      ),
      taskType: commandPriority.taskType,
      resourceType: commandPriority.resourceType,
      subject: commandTask.subject ?? examType,
      topic: commandTask.chapter ?? commandTask.title,
      masteryBefore: null,
      dueCardCount: input.overdueCardCount,
      mistakeCount: freshMistakes.length,
      questionTarget: commandTask.chapter ?? commandTask.title,
      revisionTarget: '',
      needsOnboarding: false,
      daysToExam,
      isPeakHour,
    };
  }

  // ─── P4: Active learning goal deadline pressure ───────────────────────────
  if (input.activeGoal?.target_date) {
    const daysLeft = daysUntil(input.activeGoal.target_date, now);
    if (daysLeft <= 30 && daysLeft > 0) {
      const progress = Math.round((input.activeGoal.progress ?? 0) * 100);
      return {
        targetConceptId: null,
        priority: 'goal_sprint',
        reason:
          `${daysLeft} day${daysLeft === 1 ? '' : 's'} left to reach your goal "${input.activeGoal.title}" ` +
          `(${progress}% complete). Focus on high-yield topics for this goal today.`,
        estimatedMinutes: focusMinutes,
        taskType: 'goal_sprint',
        resourceType: 'practice_questions',
        subject: examType,
        topic: input.activeGoal.title,
        masteryBefore: null,
        dueCardCount: input.overdueCardCount,
        mistakeCount: 0,
        questionTarget: input.activeGoal.title,
        revisionTarget: '',
        needsOnboarding: false,
        daysToExam,
        isPeakHour,
      };
    }
  }

  // ─── P5: Recently studied but low-mastery concepts ───────────────────────
  // (uses same weakConcepts pool but sorted differently: most recently touched first)
  // weakConcepts already filtered to mastery ∈ {not_started, exposed, developing}
  if (input.weakConcepts.length > 0) {
    // Pick the concept with the highest forgetting probability
    // (already studied once, memory decaying)
    const decaying = [...input.weakConcepts]
      .filter((c) => (c.times_reviewed ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.forgetting_probability ?? 1) - (a.forgetting_probability ?? 1)
      );

    if (decaying.length > 0) {
      const target = decaying[0];
      return {
        targetConceptId: target.id,
        priority: 'reinforcement',
        reason:
          `${target.name} (${target.subject}) was studied recently but is not yet secure ` +
          `(forgetting probability: ${Math.round((target.forgetting_probability ?? 1) * 100)}%). ` +
          `Reinforce now before memory fully decays.`,
        estimatedMinutes: focusMinutes,
        taskType: 'reinforcement',
        resourceType: 'practice_questions',
        subject: target.subject,
        topic: target.chapter,
        masteryBefore: target.mastery,
        dueCardCount: 0,
        mistakeCount: 0,
        questionTarget: target.name,
        revisionTarget: '',
        needsOnboarding: false,
        daysToExam,
        isPeakHour,
      };
    }
  }

  // ─── P6: Weakest concepts ────────────────────────────────────────────────
  if (input.weakConcepts.length > 0) {
    // Sort: mastery asc → forgetting_probability desc → times_reviewed asc
    const sorted = [...input.weakConcepts].sort((a, b) => {
      const mDiff = masteryOrder(a.mastery) - masteryOrder(b.mastery);
      if (mDiff !== 0) return mDiff;
      const fpDiff =
        (b.forgetting_probability ?? 1) - (a.forgetting_probability ?? 1);
      if (Math.abs(fpDiff) > 0.05) return fpDiff;
      return (a.times_reviewed ?? 0) - (b.times_reviewed ?? 0);
    });

    const weakest = sorted[0];
    const masteryLabel = weakest.mastery ?? 'not_started';
    const fpPct = weakest.forgetting_probability
      ? Math.round(weakest.forgetting_probability * 100)
      : null;

    return {
      targetConceptId: weakest.id,
      priority: 'concept_study',
      reason:
        `${weakest.name} (${weakest.subject}) is your weakest mapped concept ` +
        `(mastery: ${masteryLabel}${fpPct !== null ? `, ${fpPct}% forgetting probability` : ''}). ` +
        `Strengthening foundational gaps now prevents compounding difficulty later.`,
      estimatedMinutes: focusMinutes,
      taskType: 'concept_study',
      resourceType:
        masteryLabel === 'not_started' ? 'reading' : 'practice_questions',
      subject: weakest.subject,
      topic: weakest.chapter,
      masteryBefore: weakest.mastery,
      dueCardCount: input.overdueCardCount,
      mistakeCount: freshMistakes.length,
      questionTarget: weakest.name,
      revisionTarget: '',
      needsOnboarding: false,
      daysToExam,
      isPeakHour,
    };
  }

  // ─── P7: Fallback – exam/default plan (no real learner data) ─────────────
  return {
    targetConceptId: null,
    priority: 'concept_study',
    reason:
      `No study history, overdue cards, recent mistakes, or mapped concepts are available yet for ${examType}. ` +
      `Start with a short focused session so Cognition OS has a real first signal.`,
    estimatedMinutes: Math.min(focusMinutes, 25),
    taskType: 'concept_study',
    resourceType: 'reading',
    subject: examType,
    topic: 'Start with a 25-minute focused study session',
    masteryBefore: null,
    dueCardCount: 0,
    mistakeCount: 0,
    questionTarget: '',
    revisionTarget: '',
    needsOnboarding: false,
    daysToExam,
    isPeakHour,
  };
}

function mapCommandTaskType(type: string | null | undefined): {
  taskType: SessionCardTaskType;
  resourceType: SessionCardResourceType;
} {
  switch (type) {
    case 'revision':
    case 'review':
      return { taskType: 'revision', resourceType: 'flashcard_review' };
    case 'practice':
      return { taskType: 'reinforcement', resourceType: 'practice_questions' };
    case 'mock_test':
      return { taskType: 'goal_sprint', resourceType: 'practice_questions' };
    case 'study':
    default:
      return { taskType: 'concept_study', resourceType: 'reading' };
  }
}
