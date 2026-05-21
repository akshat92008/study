import { BaseService } from './base.service';
import { streamText } from '@/lib/ai/gemini';
import { ChatMemoryService } from './chat-memory.service';
import { GoalService } from './goal.service';
import { ConceptService } from './concept.service';
import { RevisionService } from './revision.service';
import { AutopsyService } from './autopsy.service';
import { PulseService } from './pulse.service';
import { MindTutorService } from './mind-tutor.service';

export class OrchestratorService extends BaseService {
  private chatMemoryService = new ChatMemoryService();
  private goalService = new GoalService();
  private conceptService = new ConceptService();
  private revisionService = new RevisionService();
  private autopsyService = new AutopsyService();
  private pulseService = new PulseService();
  private mindTutorService = new MindTutorService();

  /**
   * Processes a user message, aggregates the 7 context layers, and returns a streaming AI response.
   */
  async processUserMessage(
    userId: string,
    message: string,
    history: any[], // Recent 50 sliding window
    activeGoalId?: string,
    intent: string = 'GENERAL_CHAT'
  ): Promise<AsyncGenerator<string>> {
    
    // 1. Semantic Memory Context
    // Run search for older context if message length indicates a real query
    let semanticMemory: string[] = [];
    if (message.length > 10) {
       semanticMemory = await this.chatMemoryService.searchMemory(userId, message, 3);
    }

    // Prepare other layers concurrently to reduce latency
    const [
      activeGoal,
      masteryMetrics,
      dueCardsCount,
      latestAutopsy,
      pulseState
    ] = await Promise.all([
      this.goalService.getActiveGoal(userId, activeGoalId),
      this.conceptService.getMasteryMetrics(userId),
      this.revisionService.getDueCardsCount(userId),
      this.autopsyService.getLatestAutopsy(userId),
      this.pulseService.getPulseState(userId)
    ]);

    // 2. Student Brain / Goal Context
    const goalContext = activeGoal 
      ? `ACTIVE GOAL: ${activeGoal.title} (Status: ${activeGoal.status})` 
      : 'No active goal explicitly set for this session.';

    // 3. Mastery Context
    const masteryContext = `Average Mastery: ${masteryMetrics.averageMastery}% across ${masteryMetrics.totalConcepts} tracked concepts.`;

    // 4. Flashcard History Context
    const revisionContext = `${dueCardsCount} flashcards are currently due for review.`;

    // 5. Mock History Context
    let autopsyContext = 'No recent mock tests uploaded.';
    if (latestAutopsy) {
      autopsyContext = `Last Mock Test: ${latestAutopsy.test_name} - Score: ${latestAutopsy.score}. Extracted metrics: ${JSON.stringify(latestAutopsy.metrics)}`;
    }

    // 6. Pulse State Context
    const pulseContext = `Student State: ${pulseState.emotionalState}, Fatigue: ${pulseState.sessionFatigue}.`;

    // Assemble the complete System Prompt
    const systemPrompt = `You are MIND, the Socratic AI Orchestrator for Cognition OS.

You are interacting with the student in the main command console. Your goal is to guide them towards their learning objectives, utilizing the ecosystem of tools.

=== COGNITION OS CONTEXT LAYERS ===
[STUDENT BRAIN]: ${goalContext}
[MASTERY]: ${masteryContext}
[MEMORY/REVISION]: ${revisionContext}
[AUTOPSY HISTORY]: ${autopsyContext}
[PULSE/STATE]: ${pulseContext}

[SEMANTIC MEMORY FROM PAST CHATS]:
${semanticMemory.length > 0 ? semanticMemory.map(m => '- ' + m).join('\n') : 'No highly relevant older context found.'}

=== RULES ===
1. Keep responses incredibly concise. Avoid walls of text. 
2. Be encouraging but firm. If they are fatigued, suggest a break. If they have due cards, suggest doing them.
3. If the user asks a straightforward question, answer it succinctly. If they are struggling with a concept, use the Socratic method.
4. Format your text nicely using Markdown, bolding key terms.
`;

    // 7. Recent Chat History Context (Reconstructed for Gemini SDK)
    const formattedHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Append the latest user message
    formattedHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Instead of passing everything in one string, we format the history block for context
    const fullConversationText = formattedHistory.map(h => `${h.role.toUpperCase()}: ${h.parts[0].text}`).join('\n\n');

    if (intent === 'TUTOR_SESSION') {
      return this.mindTutorService.processTutorTurn(
        userId,
        message,
        history,
        {
          studentName: "Student", // Could fetch from profile if needed
          examType: "General",
          learningStyle: activeGoal?.preferred_learning_style || 'visual',
          masteryLevel: masteryContext,
          historicalMistakes: autopsyContext,
          ragNotes: semanticMemory.join('\n')
        }
      );
    }

    // Stream from the model (General Chat fallback)
    return streamText('pro', systemPrompt, fullConversationText);
  }
}
