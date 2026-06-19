import type { SupabaseClient } from '@supabase/supabase-js';
import { budgetedStreamGeneration } from '@/lib/ai/budgeted';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { logger } from '@/lib/utils/logger';
import { MIN_MIND_TUTOR_COVERAGE_TURNS } from '@/lib/mind/tutor-completion';
import { evaluateAnswer, persistAnswerEvaluation } from '@/lib/tutor/evaluate-answer';
import { findQuestionByText, getAllQuestionsForChapter, getNextQuestion } from '@/lib/tutor/question-engine';
import { loadActiveLearningContext } from '@/lib/learning-context/active-context';
import { buildTutorRetrievalPacket } from '@/lib/tutor/context';
import { isExplicitRagRequest } from '@/lib/rag/retrieval';
import { getDegradationMessage } from '@/lib/ai/degradation-messages';
import { getSourceGroundingState } from '@/lib/rag/source-grounding';

function explicitlyChangesTopic(message: string): boolean {
  return /\b(change|switch|move|shift)\b.{0,30}\b(topic|chapter|subject|to)\b/i.test(message)
    || /\bask me (about|on)\b/i.test(message);
}

function enqueueTextToStream(
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
    const tutorContext = await loadActiveLearningContext({
      supabase,
      userId,
      requestedGoalId: mindContext?.activeGoal?.id ?? null,
    });

    if (!tutorContext.goalId) {
      const response = 'Create or select a learning goal first, then I can keep every question and progress update tied to it.';
      enqueueTextToStream(controller, encoder, response);
      return { fullResponse: response, metadataPayload: { tutorMode: 'goal_required' } };
    }

    const requestedTopicChange = explicitlyChangesTopic(message);
    const activeChapterSlug = tutorContext.chapterSlug ?? '';
    const hasDeterministicTutorLoop = getAllQuestionsForChapter(activeChapterSlug).length > 0;

    if (hasDeterministicTutorLoop && !requestedTopicChange) {
      const explicitSourceRequest = isExplicitRagRequest(message);
      if (explicitSourceRequest) {
        const sourceState = getSourceGroundingState(tutorContext.sourceStatuses.map((source) => source.status));
        if (sourceState === 'failed') {
          const response = 'Your source failed to process. Reprocess it from Sources.';
          enqueueTextToStream(controller, encoder, response);
          return { fullResponse: response, metadataPayload: { tutorMode: 'source_failed' } };
        }
        if (sourceState === 'processing') {
          const response = 'Your source is still processing. I can continue from built-in chapter memory for now.';
          enqueueTextToStream(controller, encoder, response);
          return { fullResponse: response, metadataPayload: { tutorMode: 'source_processing' } };
        }
        if (!mindContext?.ragContext?.grounded) {
          const response = 'I could not find this in your uploaded material. Ask a more specific source-based question or reprocess the source.';
          enqueueTextToStream(controller, encoder, response);
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
          goalId: tutorContext.goalId,
          missionId: tutorContext.topicId,
          microtargetId: tutorContext.topicId,
          taxonomyPath: answeredQuestion.taxonomyPath,
          errorPatterns: answeredQuestion.errorPatterns,
        });

        await persistAnswerEvaluation({
          supabase,
          userId,
          question: answeredQuestion,
          userAnswer: message,
          evaluation,
          chapterSlug: activeChapterSlug,
          goalId: tutorContext.goalId,
          missionId: tutorContext.topicId,
          microtargetId: tutorContext.topicId,
        }).catch((error) => {
          logger.error('answer_evaluation_persistence_failed', error, {
            userId,
            goalId: tutorContext.goalId,
            questionId: answeredQuestion.questionId,
          });
        });

        logger.info('answer_evaluated', {
          userId,
          goalId: tutorContext.goalId,
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
        currentMicrotargetId: tutorContext.topicId,
        weakAreas,
        recentQuestions,
        mode: tutorContext.mode,
      });

      const response = [
        formatTutorStateLine(tutorContext, evaluation),
        evaluation?.feedback,
        nextQuestion ? `Diagnostic question:\n${nextQuestion.question}` : 'I could not find a mapped diagnostic question for this chapter yet.',
      ].filter(Boolean).join('\n\n');
      enqueueTextToStream(controller, encoder, response);

      logger.info('tutor_question_generated', {
        userId,
        goalId: tutorContext.goalId,
        chapterSlug: activeChapterSlug,
        questionId: nextQuestion?.questionId,
        source: nextQuestion?.source,
      });

      return {
        fullResponse: response,
        metadataPayload: {
          tutorMode: 'deterministic_template',
          chapterSlug: activeChapterSlug,
          canonicalGoalSlug: tutorContext.canonicalGoalSlug,
          activeGoal: tutorContext.rawGoal?.title ?? null,
          topicSlug: tutorContext.topicId,
          weakAreas,
          question: nextQuestion ?? null,
          evaluation,
          ragGrounded: Boolean(mindContext?.ragContext?.grounded),
        },
      };
    }

    const topic = requestedTopicChange ? (intent.topic || message) : (tutorContext.chapterId || intent.topic || 'General');
    const subject = requestedTopicChange ? (intent.subject || 'General') : (tutorContext.subjectId || intent.subject || 'General');
    const packet = buildTutorRetrievalPacket(tutorContext);
    const tutorSystemPrompt = `${systemPrompt}\n\n${packet.systemPromptAddendum}`;
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
        enqueueTextToStream(controller, encoder, chunk);
        fullResponse += chunk;
      }
    } catch (error) {
      logger.warn('provider_failed', {
        userId,
        goalId: tutorContext.goalId,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = getNextQuestion({ chapterSlug: activeChapterSlug, recentQuestions: tutorContext.recentQuestions });
      fullResponse = fallback
        ? `Using offline tutor mode for this turn.\n\n${fallback.question}`
        : getDegradationMessage('provider_overloaded');
      enqueueTextToStream(controller, encoder, fullResponse);
      logger.info('offline_tutor_fallback_used', { userId, goalId: tutorContext.goalId });
    }

    const coverageTurns = sessionTurnsCount ?? recentHistory.filter((turn) => turn.role === 'user').length + 1;
    return {
      fullResponse,
      metadataPayload: {
        tutorMode: 'provider',
        chapterSlug: tutorContext.chapterSlug,
        canonicalGoalSlug: tutorContext.canonicalGoalSlug,
        sessionComplete: coverageTurns >= MIN_MIND_TUTOR_COVERAGE_TURNS,
        coverageTurns,
      },
    };
  }
}

function formatTutorStateLine(tutorContext: Awaited<ReturnType<typeof loadActiveLearningContext>>, evaluation: ReturnType<typeof evaluateAnswer> | null) {
  const sourceState = tutorContext.sourceStatuses.length > 0
    ? tutorContext.sourceStatuses.map(source => `${source.title ?? 'Source'}: ${source.status}`).join(', ')
    : 'No uploaded source selected';
  const weakArea = evaluation?.weakAreaCandidate?.displayPath?.join(' > ')
    ?? tutorContext.recentWeakAreas[0]?.concept_tag
    ?? 'None detected yet';
  const nextAction = evaluation
    ? evaluation.nextAction === 'advance'
      ? 'Advance after one more check question.'
      : evaluation.nextAction === 'repair'
        ? 'Repair the missing points, then retry.'
        : 'Repeat this concept with a smaller hint.'
    : 'Answer the diagnostic question so I can update mastery.';

  return [
    `Tutor mode: Diagnose`,
    `Active goal: ${tutorContext.rawGoal?.title ?? 'Selected goal'}`,
    `Chapter: ${tutorContext.chapterId ?? tutorContext.chapterSlug ?? 'Unknown'}`,
    `Topic: ${tutorContext.topicId ?? 'Next mapped topic'}`,
    `Source: ${sourceState}`,
    `Weak area: ${weakArea}`,
    `Next action: ${nextAction}`,
  ].join('\n');
}
