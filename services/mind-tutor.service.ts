import { BaseService } from './base.service';
import { generateJSON } from '@/lib/ai/gemini';
import { MindTutorOutputSchema, MindTutorOutput, compileTutorSystemPrompt, MindTutorContext } from '@/lib/ai/prompts/tutor.prompt';
import { logger } from '@/lib/utils/logger';
import { ConceptService } from './concept.service';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { z } from 'zod';

export class MindTutorService extends BaseService {
  private conceptService = new ConceptService();

  /**
   * Retrieves or initializes an active FSM session state for a user.
   */
  async getOrInitializeState(userId: string, conceptId?: string | null): Promise<any> {
    const supabase = await this.getClient();

    // Check for an active session
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

    // Initialize new session
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
   * Processes a Socratic tutor turn. 
   * Returns a streaming response (AsyncGenerator) that yields the text, while background actions handle FSM state.
   */
  async processTutorTurn(
    userId: string,
    message: string,
    history: any[],
    context: Omit<MindTutorContext, 'currentState' | 'turnCount'>,
    conceptId?: string
  ): Promise<AsyncGenerator<string>> {
    
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

    let output: MindTutorOutput | null = null;
    try {
      output = await generateJSON<MindTutorOutput>('pro', systemPrompt, userPrompt, MindTutorOutputSchema);
    } catch (err) {
      logger.error('MIND Engine generateJSON failed, triggering fallback', err);
      try {
        output = await generateJSON<MindTutorOutput>('flash', systemPrompt, userPrompt + "\n\nCRITICAL: You must return valid JSON matching the schema.", MindTutorOutputSchema);
      } catch (fallbackErr) {
        logger.error('MIND Engine fallback failed', fallbackErr);
      }
    }

    if (!output) {
      return this.simulateStream("I hit a temporary cognitive snag interpreting that. Could you rephrase your thought?");
    }

    // Update State & Fire Background Actions. 
    // If it reaches SYNTHESIS, it will return the personalized closing message.
    const closingMessage = await this.handleStateTransition(userId, sessionState.id, output);

    // We yield the LLM's response, and if the session just completed, we append the personalized sign-off.
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

    // 1. Update FSM State
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

    // 2. Wire MIND -> MEMORY (Gap Detection Creates Cards Immediately)
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

    // 3. SYNTHESIS Block: Final updates and personalized closing message generation
    if (isCompleted) {
      let oldMastery = 'unknown';
      let newMastery = 'unknown';
      let pastMistakeStr = 'None';
      const cardsCreatedCount = output.recommendedFlashcards?.length || 0;

      // Fetch pre-synthesis data for the narrative
      if (targetConceptId) {
        const { data: cBefore } = await supabase.from('concepts').select('mastery').eq('id', targetConceptId).maybeSingle();
        oldMastery = cBefore?.mastery || 'unknown';

        // Check for related autopsy mistake
        const { data: mistake } = await supabase.from('mistakes').select('category, created_at')
          .eq('concept_id', targetConceptId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (mistake) pastMistakeStr = `${mistake.category} mistake on ${new Date(mistake.created_at).toLocaleDateString()}`;
      }

      // ATLAS Write-back
      if (output.masteryUpdate && output.masteryUpdate.conceptId) {
        await updateConceptState(
          output.masteryUpdate.conceptId,
          output.masteryUpdate.isMastered,
          0
        );
      }

      // Generate final batch of synthesis cards
      if (output.recommendedFlashcards && output.recommendedFlashcards.length > 0 && targetConceptId) {
        for (const card of output.recommendedFlashcards) {
           await createSingleCard(userId, targetConceptId, card.front, card.back, subject, chapter);
        }
      }

      // Fetch post-synthesis data
      if (targetConceptId) {
        const { data: cAfter } = await supabase.from('concepts').select('mastery').eq('id', targetConceptId).maybeSingle();
        newMastery = cAfter?.mastery || 'unknown';
      }

      // =====================================================================
      // [TASK 2.3] Generate Personalized Session Closing Message
      // =====================================================================
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
