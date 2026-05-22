import { BaseService } from './base.service';
import { generateJSON } from '@/lib/ai/gemini';
import { MindTutorOutputSchema, MindTutorOutput, compileTutorSystemPrompt, MindTutorContext } from '@/lib/ai/prompts/tutor.prompt';
import { logger } from '@/lib/utils/logger';
import { ConceptService } from './concept.service';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { z } from 'zod';

// The exact snag string — used to detect repeat failures in chat history
const SNAG_MESSAGE = "I hit a temporary cognitive snag interpreting that. Could you rephrase your thought?";

// Circuit breaker: if this many consecutive snag messages are in the trailing
// history, treat the AI as unavailable and return a terminal error instead of
// spamming the same fallback indefinitely.
const SNAG_CIRCUIT_BREAKER_THRESHOLD = 2;

export class MindTutorService extends BaseService {
  private conceptService = new ConceptService();

  /**
   * Retrieves or initializes an active FSM session state for a user.
   */
  async getOrInitializeState(userId: string, conceptId?: string | null): Promise<any> {
    const supabase = await this.getClient();

    let query = supabase.from('tutor_session_states')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: existingSession } = await query.maybeSingle();

    if (existingSession) {
      return existingSession;
    }

    const { data: newSession, error } = await supabase.from('tutor_session_states').insert({
      user_id: userId,
      session_id: crypto.randomUUID(),
      concept_id: conceptId || null,
      current_state: 'DIAGNOSTIC',
      turns_count: 0
    }).select().single();

    if (error) {
      logger.error('Failed to initialize tutor state', error);
      return { id: 'fallback', session_id: 'fallback', current_state: 'DIAGNOSTIC', turns_count: 0 };
    }

    return newSession;
  }

  /**
   * Counts how many of the most recent assistant messages in history are
   * the snag fallback string. Used by the circuit breaker.
   */
  private countTrailingSnags(history: any[]): number {
    let count = 0;
    const assistantMessages = [...history].reverse().filter(m => m.role === 'assistant');
    for (const msg of assistantMessages) {
      if (typeof msg.content === 'string' && msg.content.trim() === SNAG_MESSAGE.trim()) {
        count++;
      } else {
        break; // Stop at the first non-snag assistant message
      }
    }
    return count;
  }

  /**
   * Processes a Socratic tutor turn.
   * Returns a streaming response (AsyncGenerator) that yields the text,
   * while background actions handle FSM state.
   *
   * Circuit breaker: if the LLM has already failed SNAG_CIRCUIT_BREAKER_THRESHOLD
   * times in a row, we return a terminal error message instead of repeating
   * the snag string indefinitely.
   */
  async processTutorTurn(
    userId: string,
    message: string,
    history: any[],
    context: Omit<MindTutorContext, 'currentState' | 'turnCount'>,
    conceptId?: string
  ): Promise<AsyncGenerator<string>> {

    // ── Circuit Breaker Check ─────────────────────────────────────────────
    const trailingSnags = this.countTrailingSnags(history);
    if (trailingSnags >= SNAG_CIRCUIT_BREAKER_THRESHOLD) {
      logger.error('MIND circuit breaker tripped — AI unavailable for this session', { userId, trailingSnags });
      return this.simulateStream(
        "⚠️ The AI core appears to be temporarily unavailable. " +
        "This is usually caused by a downstream model outage. " +
        "Please refresh the page and try again in a moment. " +
        "If the problem persists, your session will be restored automatically."
      );
    }

    const sessionState = await this.getOrInitializeState(userId, conceptId);

    const fullContext: MindTutorContext = {
      ...context,
      currentState: sessionState.current_state,
      turnCount: sessionState.turns_count
    };

    const systemPrompt = compileTutorSystemPrompt(fullContext);

    const recentHistoryText = (history || [])
      .slice(-6)
      .map((m: any) => `${m.role === 'user' ? 'Student' : 'MIND'}: ${m.content}`)
      .join('\n');

    const userPrompt = `${recentHistoryText}\nStudent: ${message}`;

    // ── Two-tier LLM Retry ────────────────────────────────────────────────
    // Attempt 1: Pro model (highest quality)
    // Attempt 2: Flash model with stricter JSON instruction (fast fallback)
    // If both fail: emit snag once. Circuit breaker catches repeated failures.
    let output: MindTutorOutput | null = null;
    try {
      output = await generateJSON<MindTutorOutput>('pro', systemPrompt, userPrompt, MindTutorOutputSchema);
    } catch (err) {
      logger.error('MIND Engine generateJSON (pro) failed, falling back to flash', err);
      try {
        output = await generateJSON<MindTutorOutput>(
          'flash',
          systemPrompt,
          userPrompt + '\n\nCRITICAL: You must return valid JSON matching the schema exactly.',
          MindTutorOutputSchema
        );
      } catch (fallbackErr) {
        logger.error('MIND Engine generateJSON (flash) fallback also failed', fallbackErr);
      }
    }

    if (!output) {
      // Emit the snag once. On the next user message, countTrailingSnags()
      // will detect it and the circuit breaker will fire instead of repeating.
      return this.simulateStream(SNAG_MESSAGE);
    }

    const closingMessage = await this.handleStateTransition(userId, sessionState.id, output);
    return this.streamWithOptionalClosing(output.responseToStudent, closingMessage);
  }

  private async handleStateTransition(userId: string, stateId: string, output: MindTutorOutput): Promise<string | null> {
    if (stateId === 'fallback') return null;

    const supabase = await this.getClient();
    const isCompleted = output.state === 'SYNTHESIS';

    const { data: previousState } = await supabase
      .from('tutor_session_states')
      .select('misconception_detected, concept_id')
      .eq('id', stateId)
      .maybeSingle();

    await supabase.from('tutor_session_states')
      .update({
        current_state: output.state,
        misconception_detected: output.diagnosedMisconception,
        is_completed: isCompleted,
        turns_count: supabase.rpc('increment', { x: 1 }),
        updated_at: new Date().toISOString()
      })
      .eq('id', stateId);

    const targetConceptId = previousState?.concept_id || output.masteryUpdate?.conceptId;
    let subject = 'MIND Tutor';
    let chapter = 'Generated';

    if (targetConceptId) {
      const { data: concept } = await supabase.from('concepts').select('subject, chapter').eq('id', targetConceptId).maybeSingle();
      if (concept) {
        subject = concept.subject;
        chapter = concept.chapter;
      }
    }

    if (
      output.diagnosedMisconception &&
      targetConceptId &&
      output.diagnosedMisconception !== previousState?.misconception_detected
    ) {
      await createSingleCard(
        userId,
        targetConceptId,
        `[Tutor Gap] Address this misconception: ${output.diagnosedMisconception}`,
        `Detected during Socratic session on ${new Date().toLocaleDateString()}. Review your foundations for ${chapter}.`,
        subject,
        chapter
      );
    }

    if (isCompleted) {
      let oldMastery = 'unknown';
      let newMastery = 'unknown';
      let pastMistakeStr = 'None';
      const cardsCreatedCount = output.recommendedFlashcards?.length || 0;

      if (targetConceptId) {
        const { data: cBefore } = await supabase.from('concepts').select('mastery').eq('id', targetConceptId).maybeSingle();
        oldMastery = cBefore?.mastery || 'unknown';

        const { data: mistake } = await supabase.from('mistakes').select('category, created_at')
          .eq('concept_id', targetConceptId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (mistake) pastMistakeStr = `${mistake.category} mistake on ${new Date(mistake.created_at).toLocaleDateString()}`;
      }

      if (output.masteryUpdate && output.masteryUpdate.conceptId) {
        await updateConceptState(
          output.masteryUpdate.conceptId,
          output.masteryUpdate.isMastered,
          0
        );
      }

      if (output.recommendedFlashcards && output.recommendedFlashcards.length > 0 && targetConceptId) {
        for (const card of output.recommendedFlashcards) {
          await createSingleCard(userId, targetConceptId, card.front, card.back, subject, chapter);
        }
      }

      if (targetConceptId) {
        const { data: cAfter } = await supabase.from('concepts').select('mastery').eq('id', targetConceptId).maybeSingle();
        newMastery = cAfter?.mastery || 'unknown';
      }

      return await this.generateSessionClosingMessage(
        chapter,
        output.diagnosedMisconception,
        cardsCreatedCount,
        oldMastery,
        newMastery,
        pastMistakeStr
      );
    }

    return null;
  }

  private async generateSessionClosingMessage(
    conceptName: string,
    gapIdentified: string | null,
    cardsCount: number,
    oldMastery: string,
    newMastery: string,
    pastMistake: string
  ): Promise<string> {
    const prompt = `
    You are the closing intelligence of Cognition OS. The student just finished a rigorous Socratic session.
    Generate a highly personalized 3-sentence closing message.

    DATA DELTAS:
    - Concept: ${conceptName}
    - Gap Identified: ${gapIdentified || 'None, solid understanding.'}
    - Cards Added to FSRS Queue: ${cardsCount}
    - Mastery Change in ATLAS: ${oldMastery.replace('_', ' ')} -> ${newMastery.replace('_', ' ')}
    - Related Past Mistake: ${pastMistake}

    RULES:
    1. Be direct, authoritative, and grounding like an elite coach.
    2. Reference the exact gap and past mistake if they exist.
    3. Reference the mastery jump and cards added.
    4. End with a precise look-ahead to tomorrow.

    Example: "Good session. You nailed reaction mechanisms but got stuck on activation energy — same gap as your mock test last week. I've added 3 cards for that. Your Organic Chemistry mastery just moved from Developing to Proficient. Tomorrow I'll start there — let's close it before your exam."
    `;

    const schema = z.object({ closingMessage: z.string() });

    try {
      const result = await generateJSON<{ closingMessage: string }>('flash', 'You are an elite academic coach.', prompt, schema);
      return result.closingMessage;
    } catch (err) {
      logger.error('Failed to generate closing narrative', err);
      return `Good session. Your mastery in ${conceptName} has been updated. I've scheduled your review cards for tomorrow.`;
    }
  }

  private async *simulateStream(text: string): AsyncGenerator<string> {
    const words = text.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(r => setTimeout(r, 20));
    }
  }

  private async *streamWithOptionalClosing(responseText: string, closingMessage: string | null): AsyncGenerator<string> {
    yield* this.simulateStream(responseText);
    if (closingMessage) {
      yield "\n\n---\n\n";
      yield* this.simulateStream(`**Session Complete:** ${closingMessage}`);
    }
  }
}
