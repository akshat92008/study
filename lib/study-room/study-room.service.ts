import type { SupabaseClient } from '@supabase/supabase-js';
import { budgetedStreamGeneration } from '@/lib/ai/budgeted';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { logger } from '@/lib/utils/logger';
import { getDegradationMessage } from '@/lib/ai/degradation-messages';
import { createMaterialWeakArea } from '@/lib/weak-areas/create-weak-area';
import { QuestionBankService } from '@/lib/materials/question-bank-service';

export class StudyRoomTutorService {
  static async handleMaterialSession({
    supabase,
    userId,
    sessionId,
    currentMaterialId,
    selectedMaterialIds,
    currentTopic,
    studyRoomIntent,
    message,
    recentHistory,
    systemPrompt,
    mindContext,
    controller,
    encoder
  }: {
    supabase: SupabaseClient;
    userId: string;
    sessionId: string;
    currentMaterialId?: string;
    selectedMaterialIds?: string[];
    currentTopic?: string;
    studyRoomIntent?: string;
    message: string;
    recentHistory: any[];
    systemPrompt: string;
    mindContext: any;
    controller: ReadableStreamDefaultController;
    encoder: TextEncoder;
  }) {
    let fullResponse = '';
    const activeMaterialId = currentMaterialId || (selectedMaterialIds && selectedMaterialIds.length > 0 ? selectedMaterialIds[0] : undefined);
    const intentStr = studyRoomIntent || 'general';

    let tutorSystemPrompt = systemPrompt;

    if (intentStr === 'generate_similar' || intentStr === 'question_bank') {
       if (activeMaterialId) {
         const materialQuestions = await QuestionBankService.getMaterialQuestions(supabase, activeMaterialId, currentTopic);
         const fingerprint = QuestionBankService.getQuestionBankFingerprint(materialQuestions);
         if (fingerprint) {
           tutorSystemPrompt += `\n\n## QUESTION BANK STYLE GUIDANCE\nThe following questions were extracted from the student's material. Match their style, difficulty, and format exactly:\n\n${fingerprint}`;
         }
       }
    }

    tutorSystemPrompt += `\n\n## WEAK AREA TRACKING\nIf you ask the user a question and they get it wrong, or if they demonstrate a clear misunderstanding of a concept, you MUST output a weak area tag exactly like this at the end of your response:\n<weak-area concept="[Concept Name]" weakness="[What they got wrong]" evidence="[Their quote]" repair="[How to fix it]"/>`;

    try {
      const generator = await budgetedStreamGeneration({
        userId,
        feature: 'tutor',
        route: 'chat:study-room',
        model: 'pro',
        systemPrompt: tutorSystemPrompt,
        userPrompt: buildConversationMessages(recentHistory, message),
        maxOutputTokens: 1500,
      });

      for await (const chunk of generator) {
        controller.enqueue(encoder.encode(chunk));
        fullResponse += chunk;
      }
    } catch (error) {
      logger.warn('provider_failed_study_room', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      fullResponse = getDegradationMessage('provider_overloaded');
      controller.enqueue(encoder.encode(fullResponse));
    }

    // Process <weak-area> tags post-generation
    const weakAreaRegex = /<weak-area\s+concept="([^"]*)"\s+weakness="([^"]*)"\s+evidence="([^"]*)"\s+repair="([^"]*)"\s*\/>/g;
    let match;
    let weakAreaCreated = false;
    while ((match = weakAreaRegex.exec(fullResponse)) !== null) {
      const [, concept, weakness, evidence, repair] = match;
      try {
        await createMaterialWeakArea({
          userId,
          materialId: activeMaterialId,
          studySessionId: sessionId,
          topic: currentTopic,
          concept,
          weaknessDescription: weakness,
          evidenceText: evidence,
          repairSuggestion: repair,
        });
        weakAreaCreated = true;
      } catch (err) {
        logger.error('Failed to create weak area from Study Room stream', err);
      }
    }

    // Clean up the response to remove the internal tag before returning
    fullResponse = fullResponse.replace(weakAreaRegex, '').trim();

    return {
      fullResponse,
      metadataPayload: {
        tutorMode: 'study_room',
        currentTopic,
        activeMaterialId,
        studyRoomIntent: intentStr,
        weakAreaCreated,
      },
    };
  }
}
