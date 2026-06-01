import { createAdminClient } from '@/lib/supabase/admin';
import { generateCardsForConcept } from './revision-engine';
import { logger } from '@/lib/utils/logger';

export type LearnerEventType =
  | 'QUIZ_ATTEMPTED'
  | 'CARD_REVIEWED'
  | 'SESSION_COMPLETED'
  | 'EMOTIONAL_STATE_REPORTED'
  | 'SESSION_SKIPPED'
  | 'TASK_COMPLETED'
  | 'STUDY_SESSION_COMPLETED'
  | 'MIND_TUTOR_COMPLETED'
  | 'MEMORY_CARD_REVIEWED'
  | 'AUTOPSY_MOCK_PROCESSED'
  | 'ATLAS_MASTERY_UPDATED';

export interface LearnerTelemetryEvent {
  userId: string;
  type: LearnerEventType;
  data: {
    conceptId?: string;
    subject?: string;
    chapter?: string;
    isCorrect?: boolean;
    rating?: number; // FSRS rating 1-4
    responseTimeMs?: number;
    understandingGained?: boolean;
    emotionalState?: string;
    skippedDaysCount?: number;
    taskId?: string;
    [key: string]: any;
  };
}

/**
 * The Learning State Engine & Orchestrator models the student's dynamic states
 * and triggers reactive adjustments to roadmaps, plans, and revisions.
 */
export class LearningStateEngine {
  /**
   * Ingests a student event, logs it to database, updates the learning state metrics,
   * and triggers reactive rules.
   */
  static async ingestEvent(event: LearnerTelemetryEvent): Promise<void> {
    const { EventDispatcher } = await import('../events/orchestrator');
    
    // Instead of processing immediately, we push it to the robust event bus for reliable processing
    await EventDispatcher.publish({
      user_id: event.userId,
      type: event.type as any, // Cast legacy types
      data: event.data,
      idempotency_key: event.data.taskId || undefined, // Use task ID as idempotency if available
      metadata: {}
    });
  }

  /**
   * Internal method called by the EventOrchestrator to actually process the metrics.
   */
  static async processLegacyEvent(event: LearnerTelemetryEvent): Promise<void> {
    const supabase = createAdminClient();
    const { userId, type, data } = event;

    logger.info('Processing legacy telemetry event', { userId, type });

    try {
      // Note: We no longer insert into raw event tables here.
      // The EventOrchestrator handles the database persistence, retries, and locking.

      // 2. Incremental state updates based on event type
      let confDelta = 0;
      let retDelta = 0;
      let velDelta = 0;

      if (type === 'QUIZ_ATTEMPTED') {
        confDelta = data.isCorrect ? 0.02 : -0.02;
        retDelta = data.isCorrect ? 0.01 : -0.01;
      } else if (type === 'CARD_REVIEWED') {
        confDelta = (data.rating || 0) > 2 ? 0.01 : -0.01;
        retDelta = (data.rating || 0) > 2 ? 0.02 : -0.02;
      } else if (type === 'SESSION_COMPLETED') {
        confDelta = data.understandingGained ? 0.05 : -0.02;
        velDelta = data.understandingGained ? 1 : 0;
      } else if (type === 'TASK_COMPLETED') {
        velDelta = 1;
        confDelta = 0.01;
      } else if (type === 'SESSION_SKIPPED') {
        confDelta = -0.05;
        retDelta = -0.05;
      }

      // Fast incremental update for real-time freshness
      const { error: rpcErr } = await supabase.rpc('update_learner_state_incrementally', {
        p_user_id: userId,
        p_confidence_delta: confDelta,
        p_retention_delta: retDelta,
        p_velocity_delta: velDelta
      });

      if (rpcErr) {
        logger.error('Failed to update learner state incrementally', rpcErr);
      }

      // --- SESSION CARD INVALIDATION ---
      // These events change learner state enough to warrant regenerating today's card.
      const INVALIDATING_EVENT_TYPES = new Set([
        'STUDY_SESSION_COMPLETED',
        'MIND_TUTOR_COMPLETED',
        'MEMORY_CARD_REVIEWED',      // only if rating = 1 (again) or 4 (easy)
        'AUTOPSY_MOCK_PROCESSED',
        'ATLAS_MASTERY_UPDATED',
      ]);

      const shouldInvalidate =
        INVALIDATING_EVENT_TYPES.has(type) &&
        // For MEMORY_CARD_REVIEWED, only invalidate on significant ratings
        (type !== 'MEMORY_CARD_REVIEWED' || data.rating === 1 || data.rating === 4);

      if (shouldInvalidate) {
        const { invalidateSessionCard } = await import('@/lib/services/session-card-invalidation');
        await invalidateSessionCard(userId, type as any, {
          skipVersionBump: true, // LearningStateEngine already bumped it via RPC
          client: supabase,
        }).catch((err: any) =>
          logger.warn('LearningStateEngine: failed to invalidate session card', { type, err })
        );
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // 3. Evaluate Reactive Rules
      if (type === 'QUIZ_ATTEMPTED' && data.isCorrect === false && data.conceptId) {
        await this.handleConceptStruggle(userId, data.conceptId, data.subject || '', data.chapter || '');
      } else if (type === 'CARD_REVIEWED' && data.rating === 1 && data.conceptId) {
        await this.handleConceptStruggle(userId, data.conceptId, data.subject || '', data.chapter || '');
      } else if (type === 'SESSION_COMPLETED' && data.understandingGained === false && data.conceptId) {
        await this.handleConceptStruggle(userId, data.conceptId, data.subject || '', data.chapter || '');
      } else if (type === 'SESSION_SKIPPED') {
        const skippedDays = data.skippedDaysCount || 2;
        await this.handleSessionSkip(userId, skippedDays);
      } else if (type === 'TASK_COMPLETED' && data.taskId) {
        // Increment task completions in daily snapshot
        try {
          await supabase.rpc('increment_daily_tasks_completed', {
            p_user_id: userId,
            p_date: todayStr
          });
        } catch (e) {
          // Fallback if rpc is not ready
        }
      }

    } catch (err: any) {
      logger.error('Error in LearningStateEngine.ingestEvent', err);
    }
  }

  /**
   * Confidence formula: C = 0.5 * QuizAccuracy + 0.3 * CardRecallRate + 0.2 * behavioral context
   */
  static async calculateConfidence(userId: string): Promise<number> {
    const supabase = createAdminClient();

    // 1. Emotional state from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('emotional_state')
      .eq('id', userId)
      .maybeSingle();

    let moodWeight = 0.8;
    const emotionalState = profile?.emotional_state;
    if (emotionalState === 'anxious' || emotionalState === 'frustrated') {
      moodWeight = 0.6;
    } else if (emotionalState === 'motivated' || emotionalState === 'confident') {
      moodWeight = 1.0;
    }

    // 2. Quiz accuracy from performance_snapshots
    const { data: snapshots } = await supabase
      .from('performance_snapshots')
      .select('questions_attempted, questions_correct')
      .eq('user_id', userId);

    let quizAccuracy = 0.5;
    if (snapshots && snapshots.length > 0) {
      const totalAttempted = snapshots.reduce((sum, s) => sum + (s.questions_attempted || 0), 0);
      const totalCorrect = snapshots.reduce((sum, s) => sum + (s.questions_correct || 0), 0);
      if (totalAttempted > 0) {
        quizAccuracy = totalCorrect / totalAttempted;
      }
    }

    // 3. Card Recall Rate (rating > 1 in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from('revision_logs')
      .select('rating')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo);

    let cardRecallRate = 0.9;
    if (logs && logs.length > 0) {
      const correctLogs = logs.filter(l => (l.rating || 0) > 1).length;
      cardRecallRate = correctLogs / logs.length;
    }

    const confidence = 0.2 * moodWeight + 0.5 * quizAccuracy + 0.3 * cardRecallRate;
    return Math.max(0.0, Math.min(1.0, confidence));
  }

  /**
   * Retention formula: Average R across active revision cards. R = e^(ln(0.9) * t / S)
   */
  static async calculateRetention(userId: string): Promise<number> {
    const supabase = createAdminClient();

    const { data: cards } = await supabase
      .from('revision_cards')
      .select('stability, last_review')
      .eq('user_id', userId);

    if (!cards || cards.length === 0) {
      return 0.9; // Target FSRS retention
    }

    let sumRetention = 0;
    cards.forEach((c) => {
      const stability = c.stability || 1.0;
      const elapsedDays = c.last_review
        ? (Date.now() - new Date(c.last_review).getTime()) / (1000 * 3600 * 24)
        : 1.0;
      const R = Math.exp(Math.log(0.9) * (elapsedDays / stability));
      sumRetention += R;
    });

    return Math.max(0.0, Math.min(1.0, sumRetention / cards.length));
  }

  /**
   * Velocity: Count of concepts mastered in last 7 days.
   */
  static async calculateVelocity(userId: string): Promise<number> {
    const supabase = createAdminClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: concepts } = await supabase
      .from('concepts')
      .select('id')
      .eq('user_id', userId)
      .in('mastery', ['mastered', 'automated'])
      .gte('updated_at', sevenDaysAgo);

    return concepts ? concepts.length : 0;
  }

  /**
   * Struggle Index: S_I = 0.5 * (1 - R) + 0.3 * (IncorrectReviews / (Total + 1)) + 0.2 * responseTimeFriction
   */
  static async calculateStrugglePatternsAndWeakAreas(userId: string): Promise<{ weakAreas: any[]; strugglePatterns: any[] }> {
    const supabase = createAdminClient();

    const { data: concepts } = await supabase
      .from('concepts')
      .select('*')
      .eq('user_id', userId);

    if (!concepts || concepts.length === 0) {
      return { weakAreas: [], strugglePatterns: [] };
    }

    const { data: cards } = await supabase
      .from('revision_cards')
      .select('id, concept_id, stability, last_review')
      .eq('user_id', userId);

    const stabilityMap: Record<string, { stability: number; lastReview: string; cardId: string }> = {};
    const cardToConceptMap: Record<string, string> = {};
    cards?.forEach((c) => {
      if (c.concept_id) {
        stabilityMap[c.concept_id] = { stability: c.stability || 1.0, lastReview: c.last_review || '', cardId: c.id };
        cardToConceptMap[c.id] = c.concept_id;
      }
    });

    // Fetch review response times
    const { data: reviewLogs } = await supabase
      .from('revision_logs')
      .select('card_id, response_time_ms')
      .eq('user_id', userId);

    const conceptResponseTimes: Record<string, { sum: number; count: number }> = {};
    reviewLogs?.forEach((rl) => {
      const conceptId = cardToConceptMap[rl.card_id];
      if (conceptId && rl.response_time_ms) {
        if (!conceptResponseTimes[conceptId]) {
          conceptResponseTimes[conceptId] = { sum: 0, count: 0 };
        }
        conceptResponseTimes[conceptId].sum += rl.response_time_ms;
        conceptResponseTimes[conceptId].count += 1;
      }
    });

    const weakAreas: any[] = [];
    concepts.forEach((c) => {
      const cardInfo = stabilityMap[c.id];
      let R = 1.0;
      if (cardInfo) {
        const elapsedDays = cardInfo.lastReview
          ? (Date.now() - new Date(cardInfo.lastReview).getTime()) / (1000 * 3600 * 24)
          : 1.0;
        R = Math.exp(Math.log(0.9) * (elapsedDays / cardInfo.stability));
      }

      const totalReviews = c.times_reviewed || 0;
      const incorrectReviews = c.times_incorrect || 0;
      const incorrectRate = totalReviews > 0 ? incorrectReviews / (totalReviews + 1) : 0;

      const respInfo = conceptResponseTimes[c.id];
      const avgRespTime = respInfo && respInfo.count > 0 ? respInfo.sum / respInfo.count : 0;
      const responseTimeFriction = Math.min(1.0, avgRespTime / 30000);

      const SI = 0.5 * (1 - R) + 0.3 * incorrectRate + 0.2 * responseTimeFriction;

      if (SI > 0.6) {
        weakAreas.push({
          conceptId: c.id,
          conceptName: c.name,
          subject: c.subject,
          chapter: c.chapter,
          struggleIndex: SI,
          reason: SI > 0.85 ? 'severe_conceptual_struggle' : 'memory_decay_friction',
        });
      }
    });

    // Fetch mistake category counts
    const { data: mistakes } = await supabase
      .from('mistakes')
      .select('category')
      .eq('user_id', userId);

    const categoryCounts: Record<string, number> = {};
    mistakes?.forEach((m) => {
      if (m.category) {
        categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
      }
    });

    const strugglePatterns = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
    }));

    return {
      weakAreas: weakAreas.sort((a, b) => b.struggleIndex - a.struggleIndex),
      strugglePatterns,
    };
  }

  /**
   * Rule 1: Concept Struggle Handler
   * Creates revision cards, triggers prereq injection, and schedules a replan.
   */
  static async handleConceptStruggle(userId: string, conceptId: string, subject: string, chapter: string): Promise<void> {
    const supabase = createAdminClient();

    logger.info('Executing Concept Struggle Response', { userId, conceptId });

    // 1. Create Revision Flashcards if none exist
    const { data: cards } = await supabase
      .from('revision_cards')
      .select('id')
      .eq('user_id', userId)
      .eq('concept_id', conceptId)
      .limit(1);

    if (!cards || cards.length === 0) {
      if (subject && chapter) {
        // Run async in background to avoid blocking ingestion thread
        Promise.resolve().then(async () => {
          try {
            await generateCardsForConcept(userId, conceptId, subject, chapter);
            logger.info('Auto-seeded concept revision flashcards successfully', { conceptId });
          } catch (e) {
            logger.error('Failed to auto-seed revision flashcards', e);
          }
        });
      }
    }

    // 2. Adjust roadmap: Traverse unmastered prerequisites and prioritize them
    const { data: links } = await supabase
      .from('concept_links')
      .select('source_concept_id')
      .eq('user_id', userId)
      .eq('target_concept_id', conceptId)
      .eq('link_type', 'prerequisite');

    if (links && links.length > 0) {
      const sourceIds = links.map(l => l.source_concept_id);
      
      const { data: prereqs } = await supabase
        .from('concepts')
        .select('id, name, subject, chapter, mastery')
        .eq('user_id', userId)
        .in('id', sourceIds);

      const unmasteredPrereqs = prereqs?.filter(p => !['proficient', 'mastered', 'automated'].includes(p.mastery)) || [];

      // Create high-priority study tasks for unmastered prerequisites scheduled for tomorrow
      if (unmasteredPrereqs.length > 0) {
        const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const rows = unmasteredPrereqs.map(p => ({
          user_id: userId,
          title: `Prerequisite: Study ${p.name}`,
          description: `Identified bottleneck. Mastery of prerequisite "${p.name}" is required to unlock "${chapter}".`,
          type: 'study',
          subject: p.subject,
          chapter: p.chapter,
          priority: 'critical',
          estimated_minutes: 60,
          scheduled_date: tomorrowStr,
          is_completed: false,
          notes: 'Auto-prioritized by Learning State Engine struggle diagnostics.',
        }));

        await supabase.from('study_tasks').insert(rows);
        logger.info('Injected prerequisite tasks into roadmap schedule', { userId, conceptId });
      }
    }

    // 3. Trigger a replan for today/tomorrow
    const todayStr = new Date().toISOString().split('T')[0];
    await this.replanForUser(userId, todayStr);
  }

  /**
   * Rule 2: Skipped Sessions Handler
   * Lowers plan difficulty, extends milestone deadline, and triggers replan.
   */
  static async handleSessionSkip(userId: string, skippedDays: number): Promise<void> {
    const supabase = createAdminClient();

    logger.info('Executing Session Skip Response', { userId, skippedDays });

    // 1. Fetch active goal
    const { data: activeGoal } = await supabase
      .from('learning_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeGoal) {
      // Scale down plan difficulty (daily hours available) by 15% (min 1 hour/day)
      const currentHours = activeGoal.daily_hours_available ?? 8;
      const reducedHours = Math.max(1, Math.round(currentHours * 0.85));

      // Push back deadline by skipped days
      let updatedDeadline = activeGoal.target_completion_date;
      if (updatedDeadline) {
        const currentDeadlineDate = new Date(updatedDeadline);
        currentDeadlineDate.setDate(currentDeadlineDate.getDate() + skippedDays);
        updatedDeadline = currentDeadlineDate.toISOString();
      }

      await supabase
        .from('learning_goals')
        .update({
          daily_hours_available: reducedHours,
          target_completion_date: updatedDeadline,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeGoal.id);

      logger.info('Adjusted goal parameters: difficulty scaled down & deadline shifted', {
        goalId: activeGoal.id,
        newHours: reducedHours,
        newDeadline: updatedDeadline,
      });

      // 2. Trigger replan to reflect updated difficulty and priorities
      const todayStr = new Date().toISOString().split('T')[0];
      await this.replanForUser(userId, todayStr);
    }
  }

  /**
   * The legacy planner engine is explicitly disabled for the closed-beta MVP.
   * Session cards are invalidated instead; the next dashboard read selects the
   * current task from learner state without creating a planner task graph.
   */
  static async replanForUser(userId: string, dateStr: string): Promise<void> {
    const { invalidateSessionCard } = await import('@/lib/services/session-card-invalidation');
    await invalidateSessionCard(userId, 'LEARNER_STATE_UPDATED').catch((err: any) =>
      logger.warn('MVP replan disabled; session card invalidation failed', { userId, dateStr, err })
    );
  }
}

async function atomicReplan(
  supabase: any,
  userId: string,
  scheduledDate: string,
  tasks: any[]
): Promise<void> {
  const serialized = tasks.map(t => ({
    type: t.type,
    title: t.title,
    description: t.description || '',
    estimated_minutes: t.estimated_minutes || 45,
    priority: t.priority || 'medium',
    subject: t.subject || null,
    chapter: t.chapter || null,
    notes: `Generated by MVP session-card fallback: ${t.rationale}`
  }));

  const { error } = await supabase.rpc('atomic_replan', {
    p_user_id: userId,
    p_scheduled_date: scheduledDate,
    p_tasks: serialized,
  });

  if (error) {
    throw new Error(`[Replan] Atomic replan failed, original plan preserved: ${error.message}`);
  }
}
