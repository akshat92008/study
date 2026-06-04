import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { budgetedGenerateJSON } from '@/lib/ai/budgeted';
import { ensureGoalForUser, ensureSessionGoalLink, ensureSessionBelongsToUser, getActiveGoalContext } from '@/lib/services/goal-context.service';
import {
  runHermesMistakeAgent,
  buildMistakeFallback,
  writeMistakeResult,
  isHermesEnabled,
  isHermesError,
  HermesDisabledError,
} from '@/lib/hermes';

export async function POST(req: NextRequest) {
  try {
    const userClient = await createClient();
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { goalId, chatSessionId, question, myAnswer, correctAnswer, explanation } = body;

    if (!question || !myAnswer || !correctAnswer) {
      return NextResponse.json({ error: 'Question, your answer, and correct answer are required.' }, { status: 400 });
    }

    const supabase = userClient;

    // ── Validate goal/session ownership ─────────────────────────────────────
    let goalTitle: string | null = null;
    let recentWeakConcepts: Array<{ subject?: string | null; chapter?: string | null; topic?: string | null; mastery?: string | null }> = [];

    if (goalId) {
      await ensureGoalForUser(supabase, user.id, goalId);
    }
    if (chatSessionId) {
      const session = await ensureSessionBelongsToUser(supabase, user.id, chatSessionId);
      if (goalId && session.goal_id !== goalId && !session.is_global) {
        await ensureSessionGoalLink(supabase, user.id, chatSessionId, goalId);
      }
    }

    // ── Load compact goal context for Hermes ────────────────────────────────
    if (goalId) {
      try {
        const goalContext = await getActiveGoalContext(supabase, user.id, goalId);
        goalTitle = goalContext.goal.title;

        // Fetch up to 5 recent weak concepts for this goal
        const { data: weakConcepts } = await supabase
          .from('concepts')
          .select('subject, chapter, topic, mastery')
          .eq('user_id', user.id)
          .eq('goal_id', goalId)
          .in('mastery', ['not_started', 'exposed', 'developing'])
          .order('updated_at', { ascending: false })
          .limit(5);

        if (weakConcepts) {
          recentWeakConcepts = weakConcepts;
        }
      } catch {
        // Non-fatal: proceed without context
        logger.warn('Failed to load goal context for Hermes', { userId: user.id, goalId });
      }
    }

    // ── Route: Hermes or deterministic fallback ──────────────────────────────
    let hermesResult;
    let usedHermes = false;

    if (isHermesEnabled()) {
      try {
        hermesResult = await runHermesMistakeAgent({
          userId: user.id,
          goalId: goalId ?? null,
          chatSessionId: chatSessionId ?? null,
          question,
          myAnswer,
          correctAnswer,
          explanation: explanation ?? null,
          goalTitle,
          recentWeakConcepts,
        });
        usedHermes = true;
      } catch (hermesErr) {
        // Hermes failed — log internally, fall through to deterministic path
        if (hermesErr instanceof HermesDisabledError) {
          logger.info('Hermes disabled, using deterministic fallback', { userId: user.id });
        } else if (isHermesError(hermesErr)) {
          logger.warn('Hermes mistake agent failed, using deterministic fallback', {
            userId: user.id,
            goalId,
            code: (hermesErr as any).code,
          });
        } else {
          logger.warn('Unknown error from Hermes, using deterministic fallback', {
            userId: user.id,
            goalId,
          });
        }
        hermesResult = buildMistakeFallback({ question, myAnswer, correctAnswer, explanation });
      }
    } else {
      // Hermes disabled — use deterministic classification path (original behavior)
      hermesResult = await runDeterministicClassification(user.id, question, myAnswer, correctAnswer, explanation);
    }

    // ── Write results to Supabase via DB writer ──────────────────────────────
    const dbResult = await writeMistakeResult(
      supabase,
      user.id,
      goalId ?? null,
      chatSessionId ?? null,
      {
        userId: user.id,
        goalId: goalId ?? null,
        chatSessionId: chatSessionId ?? null,
        question,
        myAnswer,
        correctAnswer,
        explanation: explanation ?? null,
        goalTitle,
        recentWeakConcepts,
      },
      hermesResult
    );

    // ── Sanitize Text Fields ───────────────────────────────────────────────
    // Prevent leaking "Hermes" branding or raw JSON wrappers if the model hallucinated
    const sanitizeText = (text: string | null | undefined) => {
      if (!text) return text;
      let cleaned = text.replace(/hermes/ig, 'the AI tutor');
      // Extremely basic un-JSON if the model returned `{"diagnosis":"..."}` inside a string field
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        try {
          const parsed = JSON.parse(cleaned);
          // Try to extract the first string value it finds
          const values = Object.values(parsed);
          if (values.length > 0 && typeof values[0] === 'string') {
            cleaned = values[0];
          }
        } catch {
          // not valid JSON, leave as is
        }
      }
      return cleaned;
    };

    // ── Return enriched response ─────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      mistakeId: dbResult.mistakeId,
      concept: dbResult.conceptId ? {
        id: dbResult.conceptId,
        subject: hermesResult.subject,
        chapter: hermesResult.chapter,
        topic: hermesResult.topic,
        name: hermesResult.weakConcept.name,
      } : null,
      // Structured diagnosis (new fields from Hermes)
      category: hermesResult.category,
      diagnosis: sanitizeText(hermesResult.diagnosis),
      whyMyAnswerWasWrong: sanitizeText(hermesResult.whyMyAnswerWasWrong),
      whyCorrectAnswerWorks: sanitizeText(hermesResult.whyCorrectAnswerWorks),
      keyMissedClue: sanitizeText(hermesResult.keyMissedClue),
      confidence: hermesResult.confidence,
      safetyFlags: hermesResult.safetyFlags,
      // Cards and action
      cardsCreated: dbResult.cardIds.length,
      nextAction: hermesResult.nextAction,
      // Legacy compat fields
      classification: {
        category: hermesResult.category,
        subject: hermesResult.subject,
        chapter: hermesResult.chapter,
        topic: hermesResult.topic,
        diagnosis: hermesResult.diagnosis,
      },
      // Internal metadata (stripped by UI, used for debugging)
      _meta: {
        usedHermes,
        cardIds: dbResult.cardIds,
      },
    });

  } catch (error: any) {
    logger.error('Manual autopsy error', error);
    // Never return raw error.message to the user
    return NextResponse.json(
      { error: 'Unable to analyze this mistake right now. Try again in a moment.' },
      { status: 500 }
    );
  }
}

/**
 * Deterministic classification fallback used when HERMES_ENABLED=false.
 * Preserves original behavior from before Hermes was added.
 * Returns a HermesMistakeResult-shaped object for unified DB write path.
 */
async function runDeterministicClassification(
  userId: string,
  question: string,
  myAnswer: string,
  correctAnswer: string,
  explanation?: string | null
): Promise<import('@/lib/hermes').HermesMistakeResult> {
  const classifyPrompt = `Analyze this student mistake:
Question: ${question}
Student's Answer: ${myAnswer}
Correct Answer: ${correctAnswer}
Explanation: ${explanation || 'None'}

Return ONLY a JSON object:
{
  "category": "conceptual_gap" | "careless_error" | "time_pressure" | "misread_prompt" | "memory_gap" | "application_error" | "process_error" | "unknown",
  "subject": "<the subject/domain this belongs to, or null if unclear>",
  "chapter": "<chapter, module, or topic name, or null>",
  "topic": "<specific subtopic, or null>",
  "diagnosis": "Brief 1 sentence explanation of why they got it wrong"
}`;

  const classification = await budgetedGenerateJSON<any>({
    userId,
    feature: 'autopsy',
    route: '/api/autopsy/manual',
    model: 'flash',
    systemPrompt: 'You are an expert tutor analyzing student mistakes. Return ONLY valid JSON.',
    userPrompt: classifyPrompt,
  });

  const cardsPrompt = `Generate 3 revision cards based on this mistake:
Question: ${question}
Student's Answer: ${myAnswer}
Correct Answer: ${correctAnswer}
Explanation: ${explanation || 'None'}
Diagnosis: ${classification?.diagnosis || ''}
Mistake Type: ${classification?.category || 'unknown'}

Return ONLY a JSON object:
{
  "cards": [
    { "front": "...", "back": "...", "type": "mistake_concept" },
    { "front": "...", "back": "...", "type": "error_pattern" },
    { "front": "...", "back": "...", "type": "similar_trap" }
  ],
  "nextAction": "..."
}`;

  const cardsResult = await budgetedGenerateJSON<{ cards: any[]; nextAction: string }>({
    userId,
    feature: 'autopsy',
    route: '/api/autopsy/manual',
    model: 'flash',
    systemPrompt: 'You are an expert tutor generating flashcards for mistake revision. Return ONLY valid JSON.',
    userPrompt: cardsPrompt,
  });

  // Map to HermesMistakeResult shape for unified DB write
  const category = classification?.category ?? 'unknown';
  const cards = (cardsResult?.cards ?? []).map((c: any) => ({
    front: String(c.front ?? ''),
    back: String(c.back ?? ''),
    type: (c.type ?? 'mistake_concept') as import('@/lib/hermes').HermesCard['type'],
    difficulty: 'medium' as const,
  }));

  if (cards.length === 0) {
    // Ensure at least 1 card
    cards.push({
      front: `What is the correct answer to: ${question.slice(0, 100)}?`,
      back: correctAnswer.slice(0, 500),
      type: 'mistake_concept',
      difficulty: 'medium',
    });
  }

  return {
    category,
    subject: classification?.subject ?? null,
    chapter: classification?.chapter ?? null,
    topic: classification?.topic ?? null,
    diagnosis: classification?.diagnosis ?? 'No diagnosis available.',
    whyMyAnswerWasWrong: `Your answer "${myAnswer.slice(0, 100)}" was not correct.`,
    whyCorrectAnswerWorks: explanation ?? `The correct answer is: ${correctAnswer.slice(0, 300)}`,
    keyMissedClue: null,
    confidence: 'medium' as const,
    weakConcept: {
      subject: classification?.subject ?? null,
      chapter: classification?.chapter ?? null,
      topic: classification?.topic ?? null,
      name: classification?.topic ?? 'Unknown concept',
    },
    cards,
    nextAction: {
      label: typeof cardsResult?.nextAction === 'string' ? cardsResult.nextAction : 'Review your revision cards',
      rationale: 'Active recall helps retention after a mistake.',
      estimatedMinutes: 5,
      actionType: 'review_cards' as const,
    },
    safetyFlags: {
      possibleHallucination: false,
      needsHumanReview: false,
    },
  };
}
