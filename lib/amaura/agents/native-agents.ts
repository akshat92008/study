import { z } from 'zod';
import {
  conceptWindowDedupKey,
  eventDedupKey,
  normalizeTextKey,
  userDayDedupKey,
} from './idempotency';
import {
  countRecentRevisionCardsForConcept,
  createDailyMicrotasksForUser,
  createNotificationForUser,
  createRevisionCardsForUser,
  hasActiveRevisionCardsForConcept,
  hasRecentNotificationForUser,
  invalidateSessionCardForUser,
  loadAutopsyReportForUser,
  loadDueRevisionCardsForUser,
  loadProfileForUser,
  loadRecentPracticeEvidenceForUser,
  readPatternMemoriesForUser,
  updateConceptMasteryForUser,
  updatePatternMemoryForUser,
  updateProfileStreakForUser,
  writePatternMemoryForUser,
  type DailyMicrotaskInput,
  type RevisionCardInput,
} from './repositories';
import {
  AmauraAgentResultSchema,
  AnyPayloadSchema,
  emptyAmauraResult,
  skippedAmauraResult,
  type AmauraAgentDefinition,
  type AmauraAgentName,
} from './types';

const PracticePayloadSchema = z.object({
  practiceSetId: z.string().optional(),
  goalId: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  metrics: z.any().optional(),
  items: z.array(z.record(z.unknown())).optional(),
}).passthrough();

const StudySessionPayloadSchema = z.object({
  sessionId: z.string().optional(),
  goalId: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  conceptId: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
  topics: z.array(z.record(z.unknown())).optional(),
}).passthrough();

const AutopsyReadyPayloadSchema = z.object({
  assessmentId: z.string().optional(),
  reportId: z.string().optional(),
  goalId: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
}).passthrough();

const DailyScanPayloadSchema = z.object({
  reason: z.string().optional(),
  goalId: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
  date: z.string().optional(),
}).passthrough();

type PracticeEvidence = {
  conceptId?: string | null;
  conceptName?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  isCorrect?: boolean;
  createdAt?: string | null;
};

type WeakConcept = {
  conceptId?: string | null;
  conceptName: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  mistakeType?: string | null;
  recoverableMarks?: number | null;
};

export const PracticePatternAgent: AmauraAgentDefinition<z.infer<typeof PracticePayloadSchema>> = {
  name: 'PracticePatternAgent',
  handledEvents: ['PRACTICE_ATTEMPT_SUBMITTED', 'PRACTICE_ATTEMPT_RECORDED'],
  inputSchema: PracticePayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('PracticePatternAgent', context, payload),
  budget: { maxAiCalls: 1, model: 'gemini-flash', requireBudget: true },
  idempotency: { scope: 'user-concept-window', windowHours: 24 },
  notification: { priority: 'normal', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goalId = context.goalId ?? stringOrNull(payload.goalId ?? payload.goal_id);
    const recent = await loadRecentPracticeEvidenceForUser(context.userId, {
      goalId,
      practiceSetId: stringOrNull(payload.practiceSetId),
      fallbackItems: payload.items ?? [],
      limit: 15,
    });
    const detected = detectPracticeWeakness(recent as PracticeEvidence[]);
    if (!detected) return skippedAmauraResult('No repeated practice weakness detected.');

    const conceptKey = detected.conceptId ?? normalizeTextKey(detected.conceptName) ?? 'unknown';
    const dayWindow = context.now.toISOString().slice(0, 10);
    const notificationDedupKey = conceptWindowDedupKey({
      agentName: 'PracticePatternAgent',
      userId: context.userId,
      eventType: context.eventType,
      conceptId: detected.conceptId,
      conceptName: detected.conceptName,
      window: dayWindow,
    });

    const alreadyNotified = await hasRecentNotificationForUser(context.userId, {
      type: 'practice_pattern',
      dedupKey: notificationDedupKey,
      since: hoursAgo(context.now, 24),
    });
    if (alreadyNotified) {
      return skippedAmauraResult('Practice pattern was already handled in the last 24 hours.');
    }

    const activeCards = await hasActiveRevisionCardsForConcept(context.userId, {
      conceptId: detected.conceptId,
      conceptName: detected.conceptName,
      before: hoursFromNow(context.now, 48),
    });
    const recentCards = await countRecentRevisionCardsForConcept(context.userId, {
      conceptId: detected.conceptId,
      conceptName: detected.conceptName,
      since: daysAgo(context.now, 7),
    });
    const remainingCards = Math.max(0, Number(process.env.MAX_FLASHCARDS_PER_CONCEPT_PER_7_DAYS ?? 5) - recentCards);

    let cardsCreated = 0;
    if (!activeCards && remainingCards > 0) {
      const cards = buildPracticeCards({
        userId: context.userId,
        goalId,
        concept: detected,
        count: Math.min(5, remainingCards),
        sourceEventId: context.eventId,
        sourceWindow: dayWindow,
      });
      const created = await createRevisionCardsForUser(context.userId, cards);
      cardsCreated = created.length;
    }

    const concept = await updateConceptMasteryForUser(context.userId, detected.conceptId, {
      mastery: 'developing',
      masteryScore: 35,
      confidence: 'medium',
      forgettingProbability: 0.82,
    });

    await writePatternMemoryForUser(context.userId, {
      goalId,
      conceptId: detected.conceptId,
      subject: detected.subject,
      chapter: detected.chapter,
      topic: detected.topic ?? detected.conceptName,
      patternType: 'practice_weakness',
      pattern: `Repeated misses on ${detected.conceptName}`,
      severity: detected.wrongCount >= 4 ? 'high' : 'medium',
      confidence: detected.confidence,
      weight: detected.confidence,
      evidence: {
        eventId: context.eventId,
        wrongCount: detected.wrongCount,
        attemptCount: detected.attemptCount,
        wrongRate: detected.wrongRate,
      },
      sourceRefs: [context.eventId],
    });

    await invalidateSessionCardForUser(context.userId, goalId, {
      sourceEventId: context.eventId,
    });

    const notification = await createNotificationForUser(context.userId, {
      goalId,
      type: 'practice_pattern',
      priority: 'normal',
      title: 'Practice pattern found',
      message: `I noticed you missed ${detected.conceptName} ${detected.wrongCount} times. I created targeted revision and moved it into today's mission. Do the new cards next.`,
      actionLabel: 'Review cards',
      actionType: 'open_revision',
      actionPayload: { conceptId: detected.conceptId ?? null, conceptName: detected.conceptName },
      dedupKey: notificationDedupKey,
      metadata: { conceptKey, eventId: context.eventId },
    });

    return emptyAmauraResult({
      actionsTaken: 3 + cardsCreated,
      notificationsCreated: notification ? 1 : 0,
      cardsCreated,
      conceptsUpdated: concept ? 1 : 0,
      missionInvalidated: true,
      aiCallsUsed: context.budget.aiCallsUsed,
    });
  },
};

export const SessionCloseAgent: AmauraAgentDefinition<z.infer<typeof StudySessionPayloadSchema>> = {
  name: 'SessionCloseAgent',
  handledEvents: ['STUDY_SESSION_COMPLETED'],
  inputSchema: StudySessionPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('SessionCloseAgent', context, payload),
  budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
  idempotency: { scope: 'event' },
  notification: { priority: 'low', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goalId = context.goalId ?? stringOrNull(payload.goalId ?? payload.goal_id);
    const topics = normalizeSessionTopics(payload);
    await updateProfileStreakForUser(context.userId, { now: context.now });

    const cards: RevisionCardInput[] = [];
    for (const topic of topics.slice(0, 5)) {
      const active = await hasActiveRevisionCardsForConcept(context.userId, {
        conceptId: topic.conceptId,
        conceptName: topic.topic,
        before: daysFromNow(context.now, 30),
      });
      if (active) continue;
      cards.push({
        goalId,
        conceptId: topic.conceptId,
        front: `Recall the core idea from ${topic.topic}.`,
        back: `Explain ${topic.topic} from memory, then solve one related question.`,
        dueAt: dueForConfidence(context.now, topic.confidence),
        sourceType: 'amaura_session_close',
        sourceId: `session:${context.eventId}:${normalizeTextKey(topic.topic) ?? cards.length}`,
        metadata: {
          agent: 'SessionCloseAgent',
          conceptName: topic.topic,
          confidence: topic.confidence,
        },
      });
    }

    const created = await createRevisionCardsForUser(context.userId, cards);
    await invalidateSessionCardForUser(context.userId, goalId, {
      sourceEventId: context.eventId,
    });

    let notificationsCreated = 0;
    if (created.length > 0 || Number(payload.durationMinutes ?? 0) >= 20) {
      const notification = await createNotificationForUser(context.userId, {
        goalId,
        type: 'session_close',
        priority: 'low',
        title: 'Session closed',
        message: `I noticed what you studied. I scheduled ${created.length} revision item${created.length === 1 ? '' : 's'} from the session. Do the earliest due card next.`,
        actionLabel: 'Open revision',
        actionType: 'open_revision',
        dedupKey: userDayDedupKey({
          agentName: 'SessionCloseAgent',
          userId: context.userId,
          date: context.now.toISOString().slice(0, 10),
          reason: goalId ?? 'global',
        }),
        metadata: { eventId: context.eventId, cardsCreated: created.length },
      });
      notificationsCreated = notification ? 1 : 0;
    }

    return emptyAmauraResult({
      actionsTaken: 2 + created.length,
      notificationsCreated,
      cardsCreated: created.length,
      missionInvalidated: true,
    });
  },
};

export const AutopsyCascadeAgent: AmauraAgentDefinition<z.infer<typeof AutopsyReadyPayloadSchema>> = {
  name: 'AutopsyCascadeAgent',
  handledEvents: ['AUTOPSY_V3_REPORT_READY'],
  inputSchema: AutopsyReadyPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('AutopsyCascadeAgent', context, payload),
  budget: { maxAiCalls: 3, model: 'gemini-flash', requireBudget: true },
  idempotency: { scope: 'event' },
  notification: { priority: 'important', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goalId = context.goalId ?? stringOrNull(payload.goalId ?? payload.goal_id);
    const report = await loadAutopsyReportForUser(context.userId, {
      reportId: stringOrNull(payload.reportId),
      assessmentId: stringOrNull(payload.assessmentId),
    });
    if (!report) return skippedAmauraResult('Autopsy report not found for user.');

    const weakConcepts = extractWeakConcepts(report).slice(0, 3);
    if (weakConcepts.length === 0) return skippedAmauraResult('Autopsy report has no weak concepts.');

    const tasks: DailyMicrotaskInput[] = [];
    const cards: RevisionCardInput[] = [];
    for (const concept of weakConcepts) {
      const actions = recoveryActionsFor(concept);
      for (const action of actions) {
        if (tasks.length + cards.length >= 9) break;
        if (action.kind === 'card') {
          cards.push({
            goalId,
            conceptId: concept.conceptId,
            front: action.title,
            back: action.detail,
            dueAt: daysFromNow(context.now, 1),
            sourceType: 'amaura_autopsy_cascade',
            sourceId: `autopsy:${report.id}:${normalizeTextKey(concept.conceptName)}:${cards.length}`,
            metadata: {
              agent: 'AutopsyCascadeAgent',
              conceptName: concept.conceptName,
              mistakeType: concept.mistakeType,
            },
          });
        } else {
          tasks.push({
            goalId,
            conceptId: concept.conceptId,
            title: action.title,
            subject: concept.subject,
            topic: concept.topic ?? concept.conceptName,
            type: action.type,
            estimatedMinutes: action.minutes,
            priority: 'high',
            metadata: {
              agent: 'AutopsyCascadeAgent',
              detail: action.detail,
              mistakeType: concept.mistakeType,
              reportId: report.id,
            },
          });
        }
      }
      await updateConceptMasteryForUser(context.userId, concept.conceptId, {
        mastery: 'developing',
        masteryScore: 30,
        confidence: 'medium',
        forgettingProbability: 0.86,
      });
      await writePatternMemoryForUser(context.userId, {
        goalId,
        conceptId: concept.conceptId,
        subject: concept.subject,
        chapter: concept.chapter,
        topic: concept.topic ?? concept.conceptName,
        patternType: concept.mistakeType ?? 'autopsy_weak_concept',
        pattern: `Autopsy identified ${concept.conceptName}`,
        severity: 'high',
        confidence: 0.78,
        weight: 0.82,
        evidence: { reportId: report.id, eventId: context.eventId },
        sourceRefs: [report.id, context.eventId],
      });
    }

    const createdCards = await createRevisionCardsForUser(context.userId, cards);
    const createdTasks = await createDailyMicrotasksForUser(context.userId, tasks);
    await invalidateSessionCardForUser(context.userId, goalId, {
      sourceEventId: context.eventId,
    });

    const recoverable = Number(report.recoverable_marks_estimate ?? 0);
    const notification = await createNotificationForUser(context.userId, {
      goalId,
      type: 'autopsy_cascade',
      priority: 'important',
      title: 'Recovery mission ready',
      message: `I noticed ${weakConcepts.length} recovery pattern${weakConcepts.length === 1 ? '' : 's'}. I created your recovery mission${recoverable > 0 ? ` for about ${recoverable} recoverable marks` : ''}. Do the first recovery task today.`,
      actionLabel: 'Open mission',
      actionType: 'open_mission',
      dedupKey: `amaura:autopsy-cascade:${report.id}`,
      metadata: { reportId: report.id, recoverableMarks: recoverable },
    });

    return emptyAmauraResult({
      actionsTaken: weakConcepts.length + createdCards.length + createdTasks.length,
      notificationsCreated: notification ? 1 : 0,
      cardsCreated: createdCards.length,
      conceptsUpdated: weakConcepts.filter((concept) => concept.conceptId).length,
      missionInvalidated: true,
      aiCallsUsed: context.budget.aiCallsUsed,
    });
  },
};

export const ForgettingAgent: AmauraAgentDefinition<z.infer<typeof DailyScanPayloadSchema>> = {
  name: 'ForgettingAgent',
  handledEvents: ['STUDENT_MODEL_SYNC_REQUESTED', 'FORGETTING_SCAN_REQUESTED'],
  inputSchema: DailyScanPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('ForgettingAgent', context, payload),
  budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
  idempotency: { scope: 'user-day' },
  notification: { priority: 'low', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goalId = context.goalId ?? stringOrNull(payload.goalId ?? payload.goal_id);
    const due = await loadDueRevisionCardsForUser(context.userId, {
      goalId,
      before: daysFromNow(context.now, 1),
      limit: 20,
    });
    if (due.length === 0) return skippedAmauraResult('No high-risk due cards in the next 24 hours.');

    const tasks = due.slice(0, 5).map((card: any, index: number) => ({
      goalId,
      conceptId: card.concept_id ?? null,
      title: `Rescue memory: ${String(card.front ?? 'review card').slice(0, 90)}`,
      topic: stringOrNull(card.metadata?.conceptName),
      type: 'revision',
      estimatedMinutes: 8,
      targetCount: 1,
      priority: index < 3 ? 'high' as const : 'medium' as const,
      metadata: {
        agent: 'ForgettingAgent',
        cardId: card.id,
        due: card.due,
      },
    }));

    const created = await createDailyMicrotasksForUser(context.userId, tasks);
    if (due.length >= 5) {
      await invalidateSessionCardForUser(context.userId, goalId, {
        sourceEventId: context.eventId,
      });
    }

    const notification = due.length >= 3
      ? await createNotificationForUser(context.userId, {
          goalId,
          type: 'forgetting_scan',
          priority: 'low',
          title: 'Revision queue updated',
          message: `I noticed ${due.length} memories are at risk. I added the top ${created.length} to today's mission. Do the first rescue card next.`,
          actionLabel: 'Open revision',
          actionType: 'open_revision',
          dedupKey: userDayDedupKey({
            agentName: 'ForgettingAgent',
            userId: context.userId,
            date: context.now.toISOString().slice(0, 10),
            reason: goalId ?? 'global',
          }),
          metadata: { dueCount: due.length, eventId: context.eventId },
        })
      : null;

    return emptyAmauraResult({
      actionsTaken: created.length,
      notificationsCreated: notification ? 1 : 0,
      missionInvalidated: due.length >= 5,
    });
  },
};

export const StagnationAgent: AmauraAgentDefinition<z.infer<typeof DailyScanPayloadSchema>> = {
  name: 'StagnationAgent',
  handledEvents: ['STUDENT_MODEL_SYNC_REQUESTED', 'STAGNATION_SCAN_REQUESTED'],
  inputSchema: DailyScanPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('StagnationAgent', context, payload),
  budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
  idempotency: { scope: 'user-day' },
  notification: { priority: 'normal', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const profile = await loadProfileForUser(context.userId);
    const daysInactive = profile?.last_active_at
      ? Math.floor((context.now.getTime() - new Date(profile.last_active_at).getTime()) / 86_400_000)
      : 0;
    if (daysInactive < 2) return skippedAmauraResult('Learner is not stagnant.');

    const goalId = context.goalId ?? stringOrNull(payload.goalId ?? payload.goal_id);
    const cadence = stagnationCadence(daysInactive);
    const duration = daysInactive >= 10 ? 8 : daysInactive >= 5 ? 10 : 12;
    const notificationDedupKey = `amaura:stagnation:${context.userId}:${cadence}`;

    const alreadyNotified = await hasRecentNotificationForUser(context.userId, {
      type: 'stagnation_restart',
      dedupKey: notificationDedupKey,
      since: daysAgo(context.now, cadence.startsWith('weekly') ? 7 : 1),
    });
    if (alreadyNotified) return skippedAmauraResult('Restart notification cadence already satisfied.');

    const tasks = await createDailyMicrotasksForUser(context.userId, [{
      goalId,
      title: `Restart with ${duration} minutes`,
      type: 'restart',
      estimatedMinutes: duration,
      priority: 'medium',
      metadata: { agent: 'StagnationAgent', daysInactive },
    }]);
    await invalidateSessionCardForUser(context.userId, goalId, {
      sourceEventId: context.eventId,
    });
    const notification = await createNotificationForUser(context.userId, {
      goalId,
      type: 'stagnation_restart',
      priority: 'normal',
      title: 'Mission lightened',
      message: `I noticed your rhythm paused for ${daysInactive} days. I rebuilt today's mission as a lighter restart plan. Start with ${duration} minutes.`,
      actionLabel: 'Open mission',
      actionType: 'open_mission',
      dedupKey: notificationDedupKey,
      metadata: { daysInactive, cadence, taskCount: tasks.length },
    });

    return emptyAmauraResult({
      actionsTaken: tasks.length,
      notificationsCreated: notification ? 1 : 0,
      missionInvalidated: true,
    });
  },
};

export const PatternMemoryAgent: AmauraAgentDefinition<z.infer<typeof DailyScanPayloadSchema>> = {
  name: 'PatternMemoryAgent',
  handledEvents: ['STUDENT_MODEL_SYNC_REQUESTED', 'PATTERN_MEMORY_SCAN_REQUESTED'],
  inputSchema: DailyScanPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('PatternMemoryAgent', context, payload),
  budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
  idempotency: { scope: 'user-day' },
  notification: { priority: 'low', maxPerWindow: 1, windowHours: 168 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goalId = context.goalId ?? stringOrNull(payload.goalId ?? payload.goal_id);
    const memories = await readPatternMemoriesForUser(context.userId, {
      goalId,
      status: 'active',
      limit: 25,
    });
    if (memories.length === 0) return skippedAmauraResult('No active pattern memories to scan.');

    let decayed = 0;
    for (const memory of memories) {
      const ageDays = Math.floor((context.now.getTime() - new Date(memory.last_seen_at).getTime()) / 86_400_000);
      const weight = Number((memory as any).weight ?? 0.5);
      if (ageDays >= 21 || weight < 0.2) {
        await updatePatternMemoryForUser(context.userId, memory.id, {
          status: 'decayed',
          weight: Math.max(0.1, weight * 0.5),
          evidence: {
            ...(memory.evidence ?? {}),
            decayedAt: context.now.toISOString(),
            reason: ageDays >= 21 ? 'no_recent_mistakes_21_days' : 'low_weight',
          },
        });
        decayed++;
      }
    }

    const priorityMemories = memories
      .filter((memory: any) => Number(memory.weight ?? 0.5) >= 0.65)
      .slice(0, 3);
    const tasks = priorityMemories.map((memory: any) => ({
      goalId: memory.goal_id ?? goalId,
      conceptId: memory.concept_id ?? null,
      title: `High-priority recovery: ${memory.topic ?? memory.pattern}`,
      subject: memory.subject ?? null,
      topic: memory.topic ?? null,
      type: 'pattern_recovery',
      estimatedMinutes: 15,
      priority: 'high' as const,
      metadata: {
        agent: 'PatternMemoryAgent',
        memoryId: memory.id,
        patternType: memory.pattern_type,
      },
    }));
    const created = await createDailyMicrotasksForUser(context.userId, tasks);
    if (created.length > 0) {
      await invalidateSessionCardForUser(context.userId, goalId, {
        sourceEventId: context.eventId,
      });
    }

    const first = priorityMemories[0] as any;
    const notification = first
      ? await createNotificationForUser(context.userId, {
          goalId: first.goal_id ?? goalId,
          type: 'pattern_memory',
          priority: 'low',
          title: 'Pattern priority updated',
          message: `I noticed ${first.topic ?? first.pattern} is still repeating. I raised its priority in today's mission. Do the recovery task before new study.`,
          actionLabel: 'Open mission',
          actionType: 'open_mission',
          dedupKey: `amaura:pattern-memory:${first.id}:${weekKey(context.now)}`,
          metadata: { memoryId: first.id, decayed, createdTasks: created.length },
        })
      : null;

    return emptyAmauraResult({
      actionsTaken: created.length + decayed,
      notificationsCreated: notification ? 1 : 0,
      missionInvalidated: created.length > 0,
    });
  },
};

export const MissionAgent = noopAgent('MissionAgent', ['PLANNER_REPLAN_REQUESTED']);
export const MemoryAgent = noopAgent('MemoryAgent', ['MEMORY_CARD_CREATE_REQUESTED']);
export const AtlasAgent = noopAgent('AtlasAgent', ['ATLAS_MASTERY_UPDATE_REQUESTED']);

export const NATIVE_AMAURA_AGENTS = [
  PracticePatternAgent,
  AutopsyCascadeAgent,
  SessionCloseAgent,
  ForgettingAgent,
  StagnationAgent,
  PatternMemoryAgent,
  MissionAgent,
  MemoryAgent,
  AtlasAgent,
] as const;

function noopAgent(name: AmauraAgentName, handledEvents: string[]): AmauraAgentDefinition<Record<string, unknown>> {
  return {
    name,
    handledEvents,
    inputSchema: AnyPayloadSchema,
    outputSchema: AmauraAgentResultSchema,
    getDedupKey: (context, payload) => eventDedupKey(name, context, payload),
    budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
    idempotency: { scope: 'event' },
    notification: { priority: 'silent' },
    retry: { maxRetries: 0, retryable: false },
    async run() {
      return skippedAmauraResult(`${name} is registered but has no autonomous write path for this event.`);
    },
  };
}

function detectPracticeWeakness(items: PracticeEvidence[]) {
  const groups = new Map<string, {
    conceptId?: string | null;
    conceptName: string;
    subject?: string | null;
    chapter?: string | null;
    topic?: string | null;
    attemptCount: number;
    wrongCount: number;
    wrongLast7Days: number;
  }>();
  const sevenDaysAgoMs = Date.now() - 7 * 86_400_000;

  for (const item of items.slice(0, 15)) {
    const conceptName = item.conceptName ?? item.topic;
    const key = item.conceptId ?? normalizeTextKey(conceptName);
    if (!key || !conceptName) continue;
    const group = groups.get(key) ?? {
      conceptId: item.conceptId,
      conceptName,
      subject: item.subject,
      chapter: item.chapter,
      topic: item.topic ?? conceptName,
      attemptCount: 0,
      wrongCount: 0,
      wrongLast7Days: 0,
    };
    group.attemptCount += 1;
    if (item.isCorrect === false) {
      group.wrongCount += 1;
      const createdMs = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
      if (createdMs >= sevenDaysAgoMs) group.wrongLast7Days += 1;
    }
    groups.set(key, group);
  }

  const candidates = Array.from(groups.values())
    .map((group) => ({
      ...group,
      wrongRate: group.attemptCount > 0 ? group.wrongCount / group.attemptCount : 0,
      confidence: Math.min(0.95, 0.45 + group.wrongCount * 0.12),
    }))
    .filter((group) =>
      (group.attemptCount >= 3 && group.wrongRate >= 0.6) ||
      group.wrongLast7Days >= 3
    )
    .sort((a, b) => b.confidence - a.confidence);

  return candidates[0] ?? null;
}

function buildPracticeCards(input: {
  userId: string;
  goalId?: string | null;
  concept: ReturnType<typeof detectPracticeWeakness> & Record<string, any>;
  count: number;
  sourceEventId: string;
  sourceWindow: string;
}): RevisionCardInput[] {
  const conceptName = input.concept.conceptName;
  const templates = [
    {
      front: `What is the core rule behind ${conceptName}?`,
      back: `State the rule, one exception, and one example for ${conceptName}.`,
    },
    {
      front: `Where do you usually slip on ${conceptName}?`,
      back: `Name the error pattern, then write a one-line prevention check.`,
    },
    {
      front: `Solve a fresh one-step check for ${conceptName}.`,
      back: `Do one short problem and verify the answer against the core rule.`,
    },
    {
      front: `What clue tells you a question is testing ${conceptName}?`,
      back: `List the trigger words and the first operation you should perform.`,
    },
    {
      front: `Make ${conceptName} automatic.`,
      back: `Explain it in 30 seconds, then do two quick retrieval reps.`,
    },
  ];

  return templates.slice(0, input.count).map((card, index) => ({
    goalId: input.goalId,
    conceptId: input.concept.conceptId ?? null,
    front: card.front,
    back: card.back,
    dueAt: new Date().toISOString(),
    sourceType: 'amaura_practice_pattern',
    sourceId: `practice:${input.sourceEventId}:${input.sourceWindow}:${index}`,
    metadata: {
      agent: 'PracticePatternAgent',
      conceptName,
      wrongCount: input.concept.wrongCount,
      wrongRate: input.concept.wrongRate,
    },
  }));
}

function normalizeSessionTopics(payload: z.infer<typeof StudySessionPayloadSchema>) {
  const raw = payload.topics && payload.topics.length > 0
    ? payload.topics
    : [{
        conceptId: payload.conceptId,
        subject: payload.subject,
        chapter: payload.chapter,
        topic: payload.topic ?? payload.chapter,
        confidence: payload.confidence,
      }];

  return raw
    .map((item: any) => ({
      conceptId: stringOrNull(item.conceptId ?? item.concept_id),
      subject: stringOrNull(item.subject),
      chapter: stringOrNull(item.chapter),
      topic: stringOrNull(item.topic ?? item.name ?? item.chapter) ?? 'session topic',
      confidence: normalizeConfidence(item.confidence ?? payload.confidence),
    }))
    .filter((item) => item.topic);
}

function dueForConfidence(now: Date, confidence: 'low' | 'medium' | 'high') {
  if (confidence === 'low') return daysFromNow(now, 1);
  if (confidence === 'medium') return daysFromNow(now, 2);
  return daysFromNow(now, 5);
}

function extractWeakConcepts(report: any): WeakConcept[] {
  const topTopics = arrayFrom(report.top_topics);
  const topPatterns = arrayFrom(report.top_patterns);
  const reportJson = report.report_json && typeof report.report_json === 'object' ? report.report_json : {};
  const nested = [
    ...arrayFrom(reportJson.top_topics),
    ...arrayFrom(reportJson.weakConcepts),
    ...arrayFrom(reportJson.weak_concepts),
  ];

  const merged = [...topTopics, ...topPatterns, ...nested];
  return merged.map((item: any) => ({
    conceptId: stringOrNull(item.conceptId ?? item.concept_id),
    conceptName: stringOrNull(item.conceptName ?? item.name ?? item.topic ?? item.concept) ?? 'weak concept',
    subject: stringOrNull(item.subject),
    chapter: stringOrNull(item.chapter),
    topic: stringOrNull(item.topic ?? item.conceptName ?? item.name),
    mistakeType: normalizeMistakeType(item.mistakeType ?? item.mistake_type ?? item.type),
    recoverableMarks: numberOrNull(item.recoverableMarks ?? item.recoverable_marks),
  }));
}

function recoveryActionsFor(concept: WeakConcept) {
  const base = concept.conceptName;
  switch (concept.mistakeType) {
    case 'formula_forgotten':
    case 'memory_gap':
      return [{ kind: 'card', type: 'revision', title: `Recall formula for ${base}`, detail: `Write the formula, units, and one cue for ${base}.`, minutes: 8 }];
    case 'concept_gap':
      return [
        { kind: 'task', type: 'micro_lesson', title: `Micro-lesson: ${base}`, detail: `Review the core idea, then explain it aloud.`, minutes: 15 },
        { kind: 'card', type: 'revision', title: `Why does ${base} work?`, detail: `Explain the concept and one exception from memory.`, minutes: 8 },
      ];
    case 'calculation_error':
      return [{ kind: 'task', type: 'practice_drill', title: `Calculation drill: ${base}`, detail: `Do five short calculations and check each line.`, minutes: 12 }];
    case 'silly_mistake':
      return [{ kind: 'task', type: 'checklist', title: `Checklist: ${base}`, detail: `Read units, sign, and final ask before answering.`, minutes: 6 }];
    case 'time_pressure':
      return [{ kind: 'task', type: 'timed_microtest', title: `Timed microtest: ${base}`, detail: `Attempt three questions with a strict timer.`, minutes: 12 }];
    case 'misread_question':
      return [{ kind: 'task', type: 'attention_protocol', title: `Attention protocol: ${base}`, detail: `Underline the ask, known values, and trap words.`, minutes: 8 }];
    default:
      return [{ kind: 'task', type: 'recovery', title: `Recovery drill: ${base}`, detail: `Review the pattern and solve one targeted question.`, minutes: 12 }];
  }
}

function stagnationCadence(daysInactive: number) {
  if (daysInactive <= 3) return 'day_2_3';
  if (daysInactive <= 5) return 'day_5';
  if (daysInactive <= 10) return 'day_10';
  return `weekly_${Math.floor(daysInactive / 7)}`;
}

function normalizeMistakeType(value: unknown) {
  const text = stringOrNull(value)?.toLowerCase().replace(/\s+/g, '_') ?? null;
  if (!text) return null;
  if (text === 'formula') return 'formula_forgotten';
  if (text === 'silly_error') return 'silly_mistake';
  return text;
}

function normalizeConfidence(value: unknown): 'low' | 'medium' | 'high' {
  const text = stringOrNull(value)?.toLowerCase();
  if (text === 'high') return 'high';
  if (text === 'medium') return 'medium';
  return 'low';
}

function arrayFrom(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hoursAgo(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function hoursFromNow(now: Date, hours: number) {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}

function daysFromNow(now: Date, days: number) {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

function weekKey(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return `${now.getUTCFullYear()}-w${Math.floor(days / 7)}`;
}
