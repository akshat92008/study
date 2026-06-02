import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateJSON } from '@/lib/ai/provider-client';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { isVerifiedAutopsyMistake } from '@/lib/events/autopsy-evidence';

export interface GoalInput {
  title: string;
  deadline: string;
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  timeAvailable: number; // daily hours available
  preferredLearningStyle: 'visual' | 'auditory' | 'read_write' | 'kinesthetic';
  uploadedMaterialIds?: string[];
}

export interface CandidateTask {
  id: string; // Identifier (concept ID, card ID, backlog ID, etc.)
  title: string;
  description: string;
  type: 'study' | 'revision' | 'practice' | 'mock_test' | 'break' | 'review';
  subject?: string;
  chapter?: string;
  estimatedMinutes: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  score: number;
  rationale: string;
  metadata?: any;
}

export interface PlannedTask {
  title: string;
  description: string;
  type: 'study' | 'revision' | 'practice' | 'mock_test' | 'break' | 'review';
  subject?: string | null;
  chapter?: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_minutes: number;
  rationale: string;
  metadata?: any;
}

// Zod schemas for Gemini Roadmap generation
const RoadmapConceptSchema = z.object({
  name: z.string(),
  subject: z.string(),
  chapter: z.string(),
  topic: z.string().optional(),
  description: z.string(),
  prerequisiteNames: z.array(z.string()), // names of other concepts in the roadmap
});

const RoadmapMilestoneSchema = z.object({
  title: z.string(),
  description: z.string(),
  sequenceOrder: z.number().int(),
  concepts: z.array(RoadmapConceptSchema),
});

const RoadmapPlanSchema = z.object({
  milestones: z.array(RoadmapMilestoneSchema),
});

type RoadmapPlan = z.infer<typeof RoadmapPlanSchema>;

export class CommandPlanner {
  /**
   * Initializes a new Learning Goal, generates the full structured roadmap with milestones
   * and concepts, and populates the database concepts and concept_links tables.
   */
  async initializeGoalRoadmap(userId: string, input: GoalInput): Promise<{ goalId: string; milestonesCount: number; conceptsCount: number }> {
    const supabase = createAdminClient();

    // 1. Create the Goal Record
    const { data: goal, error: goalErr } = await supabase
      .from('learning_goals')
      .insert({
        user_id: userId,
        title: input.title,
        description: `Level: ${input.currentLevel} | Style: ${input.preferredLearningStyle} | Daily hours: ${input.timeAvailable}`,
        target_completion_date: new Date(input.deadline).toISOString(),
        current_level: input.currentLevel,
        preferred_learning_style: input.preferredLearningStyle,
        daily_hours_available: input.timeAvailable,
        status: 'active'
      })
      .select()
      .single();

    if (goalErr || !goal) {
      logger.error('Failed to create learning goal record', goalErr);
      throw new Error(`Failed to create learning goal: ${goalErr?.message}`);
    }

    // 2. Generate structured Roadmap via Gemini Pro
    const userPrompt = `
      Create a highly structured roadmap to master the learning goal: "${input.title}".
      Target completion deadline: ${input.deadline}.
      Student current level: ${input.currentLevel}.
      Preferred study style: ${input.preferredLearningStyle}.
      
      Requirements:
      - Break the goal into 3-6 progressive chronological milestones (ordered by sequenceOrder).
      - For each milestone, provide the core concepts to study.
      - Specify prerequisites (using exact concept names) to form a directed acyclic graph of knowledge dependency.
    `;

    const systemPrompt = `
      You are COMMAND, the elite operations and planning engine of Cognition OS.
      Generate a valid structured learning roadmap in JSON format matching the schema provided.
      Ensure concepts are grouped logically by subject and chapter.
    `;

    const { budgetedGenerateJSON } = await import('@/lib/ai/budgeted');
    const roadmap = await budgetedGenerateJSON<RoadmapPlan>({
      userId,
      feature: 'planner',
      route: 'planner:initialize-goal',
      model: 'pro',
      systemPrompt,
      userPrompt,
      schema: RoadmapPlanSchema,
      maxOutputTokens: 1500
    });

    if (!roadmap || !roadmap.milestones) {
      throw new Error('COMMAND failed to generate a valid roadmap JSON.');
    }

    // 3. Update the goal with generated milestones JSON
    await supabase
      .from('learning_goals')
      .update({ milestones: roadmap.milestones })
      .eq('id', goal.id);

    // 4. Flatten and insert concept nodes
    const flatConcepts: any[] = [];
    roadmap.milestones.forEach((milestone) => {
      milestone.concepts.forEach((c) => {
        flatConcepts.push({
          user_id: userId,
          goal_id: goal.id,
          name: c.name,
          subject: c.subject,
          chapter: c.chapter,
          topic: c.topic || '',
          mastery: 'not_started',
          confidence: 'low',
        });
      });
    });

    const { data: insertedConcepts, error: conceptsErr } = await supabase
      .from('concepts')
      .insert(flatConcepts)
      .select();

    if (conceptsErr || !insertedConcepts) {
      logger.error('Failed to insert concepts for goal', conceptsErr);
      throw new Error(`Failed to insert roadmap concepts: ${conceptsErr?.message}`);
    }

    // 5. Build concept name to ID map & insert dependency links
    const conceptNameToId = new Map<string, string>();
    insertedConcepts.forEach((c) => {
      conceptNameToId.set(c.name.toLowerCase().trim(), c.id);
    });

    const linksToInsert: any[] = [];
    roadmap.milestones.forEach((milestone) => {
      milestone.concepts.forEach((concept) => {
        const targetId = conceptNameToId.get(concept.name.toLowerCase().trim());
        if (!targetId) return;

        concept.prerequisiteNames.forEach((prereqName) => {
          const sourceId = conceptNameToId.get(prereqName.toLowerCase().trim());
          if (sourceId) {
            linksToInsert.push({
              user_id: userId,
              goal_id: goal.id,
              source_concept_id: sourceId,
              target_concept_id: targetId,
              link_type: 'prerequisite',
              strength: 1.0,
            });
          }
        });
      });
    });

    if (linksToInsert.length > 0) {
      const { error: linksErr } = await supabase
        .from('concept_links')
        .insert(linksToInsert);

      if (linksErr) {
        logger.error('Failed to insert concept prerequisite links', linksErr);
      }
    }

    return {
      goalId: goal.id,
      milestonesCount: roadmap.milestones.length,
      conceptsCount: flatConcepts.length,
    };
  }

  /**
   * Computes prioritization scores for all study candidates
   * based on backlog, FSRS memory decay, autopsies, and roadmap prerequisites.
   */
  async computeScores(userId: string, dateStr: string): Promise<CandidateTask[]> {
    const supabase = createAdminClient();
    const candidates: CandidateTask[] = [];

    // Resolve date boundary
    const targetDate = new Date(dateStr);
    const startOfDay = new Date(targetDate.setHours(0,0,0,0)).toISOString();
    const endOfDay = new Date(targetDate.setHours(23,59,59,999)).toISOString();

    // 1. BACKLOG TASKS: Query uncompleted tasks scheduled before the target date
    const { data: backlogTasks } = await supabase
      .from('study_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .lt('scheduled_date', startOfDay);

    if (backlogTasks) {
      backlogTasks.forEach((t) => {
        const overdueDays = Math.max(1, Math.ceil((new Date(startOfDay).getTime() - new Date(t.scheduled_date).getTime()) / (1000 * 3600 * 24)));
        const score = 100 * (1.0 + 0.15 * overdueDays);
        candidates.push({
          id: t.id,
          title: `[BACKLOG] ${t.title}`,
          description: t.description || 'Overdue study block',
          type: (t.type || 'study') as any,
          subject: t.subject || undefined,
          chapter: t.chapter || undefined,
          estimatedMinutes: t.estimated_minutes || 45,
          priority: 'critical',
          score,
          rationale: `Overdue study task from ${t.scheduled_date.split('T')[0]} (${overdueDays} days behind schedule).`,
          metadata: { backlogTaskId: t.id }
        });
      });
    }

    // 2. SPACED REPETITION (MEMORY DECAY): Query due revision cards from FSRS
    const { data: dueCards } = await supabase
      .from('revision_cards')
      .select('*')
      .eq('user_id', userId)
      .lte('due', endOfDay);

    if (dueCards && dueCards.length > 0) {
      // Group due cards by subject + chapter to create balanced micro-sessions
      const groupedCards: Record<string, typeof dueCards> = {};
      dueCards.forEach((c) => {
        const key = `${c.subject}|||${c.chapter}`;
        if (!groupedCards[key]) groupedCards[key] = [];
        groupedCards[key].push(c);
      });

      Object.entries(groupedCards).forEach(([key, cards]) => {
        const [subject, chapter] = key.split('|||');
        const maxForgetting = Math.max(...cards.map(c => c.forgetting_probability || 0));
        
        // Spaced repetition score peaks at 100 when forgetting prob is 1.0 (imminent recall failure)
        const score = 80 * (1.0 + maxForgetting) + Math.min(20, cards.length * 1.5);
        const estMinutes = Math.min(60, Math.max(15, cards.length * 2.0));

        candidates.push({
          id: `revision-${subject}-${chapter}`,
          title: `Revise: ${chapter}`,
          description: `Active spaced repetition review for ${cards.length} due memory cards.`,
          type: 'revision',
          subject,
          chapter,
          estimatedMinutes: estMinutes,
          priority: score > 120 ? 'critical' : score > 90 ? 'high' : 'medium',
          score,
          rationale: `Spaced repetition queue trigger. Memory decay rate is high (max forgetting probability: ${Math.round(maxForgetting * 100)}%).`,
          metadata: { cardIds: cards.map(c => c.id) }
        });
      });
    }

    // 3. AUTOPSY RECOVERY: Query mistakes to build diagnostic practice blocks
    const { data: recentMistakes } = await supabase
      .from('mistakes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentMistakes && recentMistakes.length > 0) {
      const groupedMistakes: Record<string, typeof recentMistakes> = {};
      recentMistakes.forEach((m) => {
        const key = `${m.subject}|||${m.chapter}`;
        if (!groupedMistakes[key]) groupedMistakes[key] = [];
        groupedMistakes[key].push(m);
      });

      Object.entries(groupedMistakes).forEach(([key, mList]) => {
        const [subject, chapter] = key.split('|||');
        const totalMarksLost = mList.reduce((sum, m) => sum + (m.marks_lost || 0), 0);
        
        // Autopsy score is boosted by marks lost
        const score = 75 * (1.0 + Math.min(2.0, totalMarksLost / 30.0)) + Math.min(15, mList.length * 2);
        const estMinutes = Math.min(90, Math.max(30, mList.length * 15));

        candidates.push({
          id: `autopsy-${subject}-${chapter}`,
          title: `Practice: ${chapter} Recovery`,
          description: `Targeted mistake autopsy training on ${mList.length} recent incorrect questions.`,
          type: 'practice',
          subject,
          chapter,
          estimatedMinutes: estMinutes,
          priority: score > 110 ? 'high' : 'medium',
          score,
          rationale: `Autopsy diagnostic rule. Student lost ${totalMarksLost} points in this chapter recently due to calculated/conceptual mistakes.`,
          metadata: { mistakeIds: mList.map(m => m.id) }
        });
      });
    }

    // 4. NEW CONCEPTS (ROADMAP PROGRESSION): Query concepts with prerequisites met
    // A. Fetch all active concepts and links
    const { data: allConcepts } = await supabase
      .from('concepts')
      .select('*')
      .eq('user_id', userId);

    const { data: allLinks } = await supabase
      .from('concept_links')
      .select('*')
      .eq('user_id', userId)
      .eq('link_type', 'prerequisite');

    if (allConcepts) {
      const conceptMap = new Map<string, typeof allConcepts[0]>();
      allConcepts.forEach(c => conceptMap.set(c.id, c));

      // Build target -> sources mapping of prerequisites
      const prereqs = new Map<string, string[]>();
      if (allLinks) {
        allLinks.forEach((link) => {
          if (!prereqs.has(link.target_concept_id)) {
            prereqs.set(link.target_concept_id, []);
          }
          prereqs.get(link.target_concept_id)!.push(link.source_concept_id);
        });
      }

      // Filter eligible concepts (not mastered yet and prerequisites met)
      allConcepts.forEach((concept) => {
        // Skip if already proficient or mastered
        if (['proficient', 'mastered', 'automated'].includes(concept.mastery)) {
          return;
        }

        // Check prerequisites
        const prereqIds = prereqs.get(concept.id) || [];
        const allPrereqsMet = prereqIds.every((id) => {
          const prereqConcept = conceptMap.get(id);
          return prereqConcept && ['proficient', 'mastered', 'automated'].includes(prereqConcept.mastery);
        });

        if (allPrereqsMet) {
          // Score decays as mastery level increases (prioritizes unexposed topics)
          const masteryDiscount = concept.mastery === 'not_started' ? 1.0 : concept.mastery === 'exposed' ? 0.8 : 0.5;
          const score = 50 * masteryDiscount;

          candidates.push({
            id: concept.id,
            title: `Learn: ${concept.name}`,
            description: `Study new milestone node in chapter "${concept.chapter}".`,
            type: 'study',
            subject: concept.subject,
            chapter: concept.chapter,
            estimatedMinutes: 60, // standard study block
            priority: 'medium',
            score,
            rationale: `Roadmap progression step. All dependencies are met. Mastery of "${concept.name}" is currently "${concept.mastery}".`,
            metadata: { conceptId: concept.id }
          });
        }
      });
    }

    // Sort candidates by score descending
    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Greedy Packing Algorithm that fits scored candidates into a balanced daily schedule.
   */
  packDailySchedule(candidates: CandidateTask[], dailyHours: number): PlannedTask[] {
    const totalMinutes = dailyHours * 60;
    const plannedTasks: PlannedTask[] = [];

    // Resource allocation constraints (guardrails against unrealistic overloading)
    const revisionLimit = 0.25 * totalMinutes;  // Max 25% on cards
    const backlogLimit = 0.30 * totalMinutes;   // Max 30% on overdue items
    const autopsyLimit = 0.30 * totalMinutes;   // Max 30% on mistakes
    const studyLimit = 0.40 * totalMinutes;     // Max 40% on new concepts

    let totalScheduledMinutes = 0;
    let scheduledRevision = 0;
    let scheduledBacklog = 0;
    let scheduledAutopsy = 0;
    let scheduledStudy = 0;

    // Filter and pack greedily
    for (const c of candidates) {
      if (totalScheduledMinutes + c.estimatedMinutes > totalMinutes) continue;

      let categoryFits = true;

      // Apply guardrails
      if (c.title.startsWith('[BACKLOG]')) {
        if (scheduledBacklog + c.estimatedMinutes > backlogLimit) categoryFits = false;
      } else if (c.type === 'revision') {
        if (scheduledRevision + c.estimatedMinutes > revisionLimit) categoryFits = false;
      } else if (c.type === 'practice') {
        if (scheduledAutopsy + c.estimatedMinutes > autopsyLimit) categoryFits = false;
      } else if (c.type === 'study') {
        if (scheduledStudy + c.estimatedMinutes > studyLimit) categoryFits = false;
      }

      if (categoryFits) {
        plannedTasks.push({
          title: c.title,
          description: c.description,
          type: c.type,
          subject: c.subject || null,
          chapter: c.chapter || null,
          priority: c.priority,
          estimated_minutes: c.estimatedMinutes,
          rationale: c.rationale,
          metadata: c.metadata,
        });

        totalScheduledMinutes += c.estimatedMinutes;
        
        // Track allocations
        if (c.title.startsWith('[BACKLOG]')) {
          scheduledBacklog += c.estimatedMinutes;
        } else if (c.type === 'revision') {
          scheduledRevision += c.estimatedMinutes;
        } else if (c.type === 'practice') {
          scheduledAutopsy += c.estimatedMinutes;
        } else if (c.type === 'study') {
          scheduledStudy += c.estimatedMinutes;
        }
      }
    }

    // Pacing Guardrail: Insert breaks dynamically
    const finalTasksWithBreaks: PlannedTask[] = [];
    let continuousMinutes = 0;

    plannedTasks.forEach((task) => {
      finalTasksWithBreaks.push(task);
      continuousMinutes += task.estimated_minutes;

      if (continuousMinutes >= 90) {
        finalTasksWithBreaks.push({
          title: 'Rest Break',
          description: 'Step away from screen. Hydrate and clear cognitive workload.',
          type: 'break',
          priority: 'low',
          estimated_minutes: 15,
          rationale: 'Pacing Guardrail: Scheduled rest break to optimize retention and prevent study fatigue.',
        });
        continuousMinutes = 0;
      } else if (continuousMinutes >= 50) {
        finalTasksWithBreaks.push({
          title: 'Quick Breather',
          description: 'Stretch and relax for 5-10 minutes.',
          type: 'break',
          priority: 'low',
          estimated_minutes: 10,
          rationale: 'Pacing Guardrail: Micro-break between study/practice sessions.',
        });
        continuousMinutes = 0;
      }
    });

    return finalTasksWithBreaks;
  }
}

// ------------------------------------------------------------------
// CONSUMERS
// ------------------------------------------------------------------

export class CommandConsumer {
  static async handleAutopsyProcessed(
    userId: string,
    metadata: any,
    data: any
  ): Promise<void> {
    const wrongQuestions: Array<{
      subject: string;
      chapter: string;
      mistakeCategory: string | null;
      status?: string;
      extractionConfidence?: number;
      extraction_confidence?: number;
      needsReview?: boolean;
      needs_review?: boolean;
    }> =
      metadata?.wrongQuestions || [];

    if (wrongQuestions.length === 0) return;

    const supabase = createAdminClient();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

    // Dedupe chapters — only one remediation task per chapter
    const chapters = new Map<string, { subject: string; chapter: string }>();
    for (const q of wrongQuestions) {
      if (!isVerifiedAutopsyMistake(q)) continue;
      if (q.mistakeCategory === 'silly_mistake' || q.mistakeCategory === 'time_pressure') continue;
      const key = `${q.subject}::${q.chapter}`;
      if (!chapters.has(key)) chapters.set(key, { subject: q.subject, chapter: q.chapter });
    }

    // Insert up to 3 remediation tasks for tomorrow (don't flood the plan)
    let inserted = 0;
    for (const { subject, chapter } of chapters.values()) {
      if (inserted >= 3) break;

      const resolution = await resolveConcept({
        userId,
        subject,
        chapter,
        topic: chapter,
        sourceType: 'autopsy',
        confidence: 0.8,
        client: supabase,
      });

      const { count } = await supabase
        .from('study_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('scheduled_date', tomorrow)
        .ilike('chapter', `%${chapter}%`);

      if ((count ?? 0) > 0) continue; // Already planned

      await supabase.from('study_tasks').insert({
        user_id: userId,
        concept_id: resolution.conceptId,
        title: `Remediate: ${chapter}`,
        subject,
        chapter,
        type: 'study',
        priority: 'critical',
        estimated_minutes: 30,
        scheduled_date: tomorrow,
        is_completed: false,
        notes: `Added by AUTOPSY — wrong answers detected in ${chapter}. Review concepts and redo similar questions.`,
      });

      inserted++;
    }

    if (inserted > 0) {
      await invalidateSessionCard(userId, 'AUTOPSY_COMPLETED', {
        skipVersionBump: true,
        client: supabase,
      }).catch((err: any) => logger.warn('CommandConsumer: invalidation failed', err));
    }

    logger.info(`CommandConsumer: injected ${inserted} remediation tasks for tomorrow`, { userId });
  }

  static async handleStudySessionCompleted(userId: string, data: any): Promise<void> {
    const { subject, chapter } = data || {};
    if (!subject || !chapter) return;

    const supabase = createAdminClient();
    const today = new Date().toISOString().split('T')[0];

    // Mark any matching task for today as complete
    const { error } = await supabase
      .from('study_tasks')
      .update({ is_completed: true })
      .eq('user_id', userId)
      .eq('scheduled_date', today)
      .eq('is_completed', false)
      .ilike('chapter', `%${chapter}%`);

    if (error) {
      logger.warn('CommandConsumer: failed to mark task complete', { error, chapter });
      return;
    }

    await invalidateSessionCard(userId, 'STUDY_SESSION_COMPLETED', {
      skipVersionBump: true,
      client: supabase,
    }).catch((err: any) => logger.warn('CommandConsumer: invalidation failed', err));

    logger.info(`CommandConsumer: marked task complete for ${chapter}`, { userId });
  }
}
