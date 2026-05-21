import { BaseService } from './base.service';
import { generateJSON } from '@/lib/ai/gemini';
import { MindTutorOutputSchema, MindTutorOutput, compileTutorSystemPrompt, MindTutorContext } from '@/lib/ai/prompts/tutor.prompt';
import { logger } from '@/lib/utils/logger';
import { ConceptService } from './concept.service';
import { RevisionService } from './revision.service';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { updateConceptState } from '@/lib/engines/cognition-graph';

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
    // We generate a logical session ID to track the 8-10 loop exchange
    const { data: newSession, error } = await supabase.from('tutor_session_states').insert({
      user_id: userId,
      session_id: crypto.randomUUID(),
      concept_id: conceptId || null,
      current_state: 'DIAGNOSTIC',
      turns_count: 0
    }).select().single();

    if (error) {
      logger.error('Failed to initialize tutor state', error);
      // Fallback in-memory state if DB fails
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
    
    // 1. Get FSM State
    const sessionState = await this.getOrInitializeState(userId, conceptId);
    
    // 2. Compile Prompt
    const fullContext: MindTutorContext = {
      ...context,
      currentState: sessionState.current_state,
      turnCount: sessionState.turns_count
    };
    
    const systemPrompt = compileTutorSystemPrompt(fullContext);
    
    // Build conversation history text
    const recentHistoryText = (history || [])
      .slice(-6)
      .map((m: any) => `${m.role === 'user' ? 'Student' : 'MIND'}: ${m.content}`)
      .join('\n');
    
    const userPrompt = `${recentHistoryText}\nStudent: ${message}`;

    // 3. Generate Structured Output (FSM Step)
    let output: MindTutorOutput | null = null;
    try {
      // Use pro for complex FSM tracking
      output = await generateJSON<MindTutorOutput>('pro', systemPrompt, userPrompt, MindTutorOutputSchema);
    } catch (err) {
      logger.error('MIND Engine generateJSON failed, triggering fallback', err);
      // Fallback: Deterministic retry with flash if pro fails or parse error
      try {
        output = await generateJSON<MindTutorOutput>('flash', systemPrompt, userPrompt + "\n\nCRITICAL: You must return valid JSON matching the schema.", MindTutorOutputSchema);
      } catch (fallbackErr) {
        logger.error('MIND Engine fallback failed', fallbackErr);
      }
    }

    // 4. Handle extreme fallback if everything fails
    if (!output) {
      return async function* () {
        yield "I hit a temporary cognitive snag interpreting that. Could you rephrase your thought?";
      }();
    }

    // 5. Update State & Fire Background Actions
    await this.handleStateTransition(userId, sessionState.id, output);

    // 6. Return Streaming Generator (We simulate a stream since generateJSON returns the full object)
    return this.simulateStream(output.responseToStudent);
  }

  private async handleStateTransition(userId: string, stateId: string, output: MindTutorOutput) {
    if (stateId === 'fallback') return;

    const supabase = await this.getClient();
    
    const isCompleted = output.state === 'SYNTHESIS';

    await supabase.from('tutor_session_states')
      .update({
        current_state: output.state,
        misconception_detected: output.diagnosedMisconception,
        is_completed: isCompleted,
        turns_count: supabase.rpc('increment', { x: 1 }), // Or handle locally if RPC missing
        updated_at: new Date().toISOString()
      })
      .eq('id', stateId);

    // If synthesis, handle background actions
    if (output.state === 'SYNTHESIS') {
      if (output.masteryUpdate) {
        await updateConceptState(
          output.masteryUpdate.conceptId, 
          output.masteryUpdate.isMastered, 
          0
        );
      }

      if (output.recommendedFlashcards && output.recommendedFlashcards.length > 0) {
        for (const card of output.recommendedFlashcards) {
           await createSingleCard(
             userId, 
             output.masteryUpdate?.conceptId || '', 
             card.front, 
             card.back, 
             'MIND Tutor', 
             'Generated'
           );
        }
      }
    }
  }

  private async *simulateStream(text: string): AsyncGenerator<string> {
    // Splits text into words to simulate a fast stream for the UI
    const words = text.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(r => setTimeout(r, 20));
    }
  }
}
