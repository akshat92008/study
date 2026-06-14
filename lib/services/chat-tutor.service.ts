import type { SupabaseClient } from '@supabase/supabase-js';
import { budgetedStreamGeneration } from '@/lib/ai/budgeted';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { logger } from '@/lib/utils/logger';
import { MIN_MIND_TUTOR_COVERAGE_TURNS } from '@/lib/mind/tutor-completion';
import { evaluateAnswer, persistAnswerEvaluation } from '@/lib/tutor/evaluate-answer';
import { findQuestionByText, getNextQuestion } from '@/lib/tutor/question-engine';
import { loadTutorContext } from '@/lib/tutor/context';
import { isExplicitRagRequest } from '@/lib/rag/retrieval';
import { getDegradationMessage } from '@/lib/ai/degradation-messages';
import { getSourceGroundingState } from '@/lib/rag/source-grounding';

function explicitlyChangesTopic(message: string): boolean {
  return /\b(change|switch|move|shift)\b.{0,30}\b(topic|chapter|subject|to)\b/i.test(message)
    || /\bask me (about|on)\b/i.test(message);
}

function streamText(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  text: string
) {
  controller.enqueue(encoder.encode(text));
}

export class ChatTutorService {
  static async handleTutorSession(
    supabase: SupabaseClient,
    userId: string,
    intent: any,
    mindContext: any,
    systemPrompt: string,
    recentHistory: any[],
    message: string,
    sessionTurnsCount: number | undefined,
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder
  ) {
    const tutorContext = await loadTutorContext({
      supabase,
      userId,
      activeGoalId: mindContext?.activeGoal?.id ?? null,
    });

    if (!tutorContext.activeGoalId) {
      const response = 'Create or select a learning goal first, then I can keep every question and progress update tied to it.';
      streamText(controller, encoder, response);
      return { fullResponse: response, metadataPayload: { tutorMode: 'goal_required' } };
    }

    const requestedTopicChange = explicitlyChangesTopic(message);
    const activeChapterSlug = tutorContext.chapterSlug ?? '';
    const isBiotechnology = activeChapterSlug === 'neet-biology-biotechnology';

    if (isBiotechnology && !requestedTopicChange) {
      const explicitSourceRequest = isExplicitRagRequest(message);
      if (explicitSourceRequest) {
        const sourceState = getSourceGroundingState(tutorContext.sourceStatuses.map((source) => source.status));
        if (sourceState === 'failed') {
          const response = 'Your source failed to process. Reprocess it from Sources.';
          streamText(controller, encoder, response);
          return { fullResponse: response, metadataPayload: { tutorMode: 'source_failed' } };
        }
        if (sourceState === 'processing') {
          const response = 'Your source is still processing. I can continue from built-in chapter memory for now.';
          streamText(controller, encoder, response);
          return { fullResponse: response, metadataPayload: { tutorMode: 'source_processing' } };
        }
        if (!mindContext?.ragContext?.grounded) {
          const response = 'I could not find this in your uploaded material. Ask a more specific source-based question or reprocess the source.';
          streamText(controller, encoder, response);
          return { fullResponse: response, metadataPayload: { tutorMode: 'source_not_found' } };
        }
      }

      const lastAssistant = recentHistory.slice().reverse().find((turn) => turn.role === 'assistant')?.content ?? '';
      const answeredQuestion = findQuestionByText(lastAssistant);
      let evaluation: ReturnType<typeof evaluateAnswer> | null = null;

      if (answeredQuestion) {
        evaluation = evaluateAnswer({
          question: answeredQuestion.question,
          expectedAnswerPoints: answeredQuestion.expectedAnswerPoints,
          userAnswer: message,
          conceptTags: answeredQuestion.conceptTags,
          chapterSlug: activeChapterSlug,
          goalId: tutorContext.activeGoalId,
          missionId: tutorContext.currentMissionId,
          microtargetId: tutorContext.currentMicrotargetId,
        });

        await persistAnswerEvaluation({
          supabase,
          userId,
          question: answeredQuestion,
          userAnswer: message,
          evaluation,
          chapterSlug: activeChapterSlug,
          goalId: tutorContext.activeGoalId,
          missionId: tutorContext.currentMissionId,
          microtargetId: tutorContext.currentMicrotargetId,
        }).catch((error) => {
          logger.error('answer_evaluation_persistence_failed', error, {
            userId,
            goalId: tutorContext.activeGoalId,
            questionId: answeredQuestion.questionId,
          });
        });

        logger.info('answer_evaluated', {
          userId,
          goalId: tutorContext.activeGoalId,
          questionId: answeredQuestion.questionId,
          score: evaluation.score,
          missingPoints: evaluation.missingPoints,
        });
      }

      const weakAreas = [
        ...tutorContext.recentWeakAreas,
        ...(evaluation && evaluation.score !== 'correct'
          ? answeredQuestion!.conceptTags.map((concept_tag) => ({ concept_tag, severity: evaluation!.score, missing_points: evaluation!.missingPoints }))
          : []),
      ];
      const recentQuestions = [
        ...tutorContext.recentQuestions,
        ...recentHistory.filter((turn) => turn.role === 'assistant').map((turn) => turn.content),
      ];
      const nextQuestion = getNextQuestion({
        chapterSlug: activeChapterSlug,
        currentMicrotargetId: tutorContext.currentMicrotargetId,
        weakAreas,
        recentQuestions,
        mode: tutorContext.normalizedGoal?.mode,
      });

      const response = [
        evaluation?.feedback,
        nextQuestion?.question,
      ].filter(Boolean).join('\n\n');
      streamText(controller, encoder, response);

      logger.info('tutor_question_generated', {
        userId,
        goalId: tutorContext.activeGoalId,
        chapterSlug: activeChapterSlug,
        questionId: nextQuestion?.questionId,
        source: nextQuestion?.source,
      });

      return {
        fullResponse: response,
        metadataPayload: {
          tutorMode: 'deterministic_template',
          chapterSlug: activeChapterSlug,
          question: nextQuestion ?? null,
          evaluation,
          ragGrounded: Boolean(mindContext?.ragContext?.grounded),
        },
      };
    }

    const topic = requestedTopicChange ? (intent.topic || message) : (tutorContext.chapter || intent.topic || 'General');
    const subject = requestedTopicChange ? (intent.subject || 'General') : (tutorContext.subject || intent.subject || 'General');
    const tutorSystemPrompt = `${systemPrompt}\n\nACTIVE TUTOR CONTEXT:\nGoal: ${tutorContext.goalTitle}\nExam: ${tutorContext.exam ?? 'Unknown'}\nSubject: ${subject}\nChapter: ${topic}\nChapter slug: ${tutorContext.chapterSlug ?? 'unknown'}\nStay inside this chapter unless the learner explicitly changes the topic. Ask one question at a time.`;
    let fullResponse = '';

    try {
      const generator = await budgetedStreamGeneration({
        userId,
        feature: 'tutor',
        route: 'chat:tutor',
        model: 'pro',
        systemPrompt: tutorSystemPrompt,
        userPrompt: buildConversationMessages(recentHistory, message),
        maxOutputTokens: 1000,
      });
      for await (const chunk of generator) {
        streamText(controller, encoder, chunk);
        fullResponse += chunk;
      }
    } catch (error) {
      logger.warn('provider_failed', {
        userId,
        goalId: tutorContext.activeGoalId,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = getNextQuestion({ chapterSlug: activeChapterSlug, recentQuestions: tutorContext.recentQuestions });
      fullResponse = fallback
        ? `Using offline tutor mode for this turn.\n\n${fallback.question}`
        : getDegradationMessage('provider_overloaded');
      streamText(controller, encoder, fullResponse);
      logger.info('offline_tutor_fallback_used', { userId, goalId: tutorContext.activeGoalId });
    }

    const coverageTurns = sessionTurnsCount ?? recentHistory.filter((turn) => turn.role === 'user').length + 1;
    return {
      fullResponse,
      metadataPayload: {
        tutorMode: 'provider',
        chapterSlug: tutorContext.chapterSlug,
        sessionComplete: coverageTurns >= MIN_MIND_TUTOR_COVERAGE_TURNS,
        coverageTurns,
      },
    };
  }
}
