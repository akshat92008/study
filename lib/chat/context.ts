import { createClient } from '@/lib/supabase/server';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { EpisodicMemoryService } from '@/lib/services/episodic-memory.service';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { buildMindRagContext } from '@/lib/rag/mind-rag';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { getStudyRoomSystemPrompt } from '@/lib/ai/prompts/study-room-prompt';
import { classifyMessageCombined } from '@/lib/ai/chat-intent-with-emotion';
import { logger } from '@/lib/utils/logger';
import { getRepairSignals } from '@/lib/services/repair-loop.service';
import { isExplicitRagRequest } from '@/lib/rag/retrieval';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorName: string = 'timeout'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorName)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function gatherChatContext({
  supabase,
  userId,
  message,
  recentHistory,
  isSimpleMessage,
  activeGoal,
  activeGoalId,
  sessionId,
  selectedMaterialIds,
  tutorSurface,
  exam,
  subject,
  chapterSlug,
  topicSlug,
  currentMaterialId,
  currentTopic,
  studyRoomIntent,
  studyRoomMode,
}: {
  supabase: any;
  userId: string;
  message: string;
  recentHistory: any[];
  isSimpleMessage: boolean;
  activeGoal: any;
  activeGoalId?: string;
  sessionId: string;
  selectedMaterialIds?: string[];
  tutorSurface?: boolean;
  exam?: string;
  subject?: string;
  chapterSlug?: string;
  topicSlug?: string;
  currentMaterialId?: string;
  currentTopic?: string;
  studyRoomIntent?: string;
  studyRoomMode?: string;
}) {
  const profilePromise = supabase.from('profiles').select('exam_type').eq('id', userId).maybeSingle();
  const explicitSourceRequest = isExplicitRagRequest(message || '');
  const intentPromise = isSimpleMessage 
    ? Promise.resolve({ intent: { intent: 'GENERAL_CHAT' }, emotion: 'neutral', confidence: 1.0 })
    : classifyMessageCombined(
        message || '',
        recentHistory.slice(-2).map((m: any) => m.content).join(' '),
        undefined,
        userId
      );

  const [profileResult, intentResult] = await Promise.all([
    withTimeout(profilePromise, 1000).catch(() => ({ data: null })),
    withTimeout(intentPromise, 1200).catch(() => ({
      intent: { intent: 'GENERAL_CHAT' }, emotion: 'neutral', confidence: 0.5
    }))
  ]) as [any, any];

  const profilePreview = profileResult?.data;
  const { intent: detectedIntent, emotion } = intentResult;

  const memoryPromise = (message && message.trim().length > 15 && !isSimpleMessage)
    ? new ChatMemoryService().searchMemory(userId, message, 2).catch((err) => {
        logger.error('CRITICAL: Semantic memory failed', err);
        return [] as string[];
      })
    : Promise.resolve([] as string[]);
    
  const episodicMemoryPromise = (message && message.trim().length > 15 && !isSimpleMessage)
    ? new EpisodicMemoryService().retrieveRelevant(userId, message, 2).catch((err) => {
        logger.warn('Episodic memory retrieval failed', err);
        return [] as string[];
      })
    : Promise.resolve([] as string[]);

  const hermesMemoryPromise = (!isSimpleMessage)
    ? import('@/lib/autopsy-v3/hermes-memory-writer')
        .then(mod => mod.getRelevantHermesReminders({ supabase, userId, goalId: activeGoalId, limit: 6 }))
        .catch(err => {
          logger.warn('Hermes memory retrieval failed', err);
          return [];
        })
    : Promise.resolve([]);

  const mindContextPromise = isSimpleMessage
    ? Promise.resolve({
        profile: profilePreview || { name: 'Student', examType: 'General Study' },
        activeGoal: activeGoal
          ? {
              id: activeGoal.id,
              title: activeGoal.title,
              subject: activeGoal.subject ?? null,
              domain: activeGoal.domain ?? null,
              targetLevel: activeGoal.target_level ?? null,
              targetDate: activeGoal.target_date ?? activeGoal.deadline ?? null,
              progress: activeGoal.progress ?? null,
            }
          : null,
        currentSessionCard: null,
        commandTasks: [],
        recentStudySessions: [],
        weakConcepts: [], recentMistakes: [], struggles: [],
        masteryStats: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
        overdueCardsCount: 0, topOverdueCards: [], emotionalState: 'neutral', recentTopics: [], knownAnalogies: [],
        conceptHistory: [],
        cognitiveLoad: { level: 'normal', signals: [] },
        rootGapChains: [],
        currentSessionDurationMinutes: 0,
        sessionGoal: '',
        ragChunks: [],
        ragContext: null,
        studentModel: null,
        outcomeAnalytics: null,
      })
    : withTimeout(
        getMINDContext(
          userId,
          message,
          detectedIntent.topic || undefined,
          detectedIntent.subject || undefined,
          activeGoalId || undefined
        ),
        6000,
        'mind_context_timeout'
      ).catch((err) => {
        logger.error('Failed to get MIND context (or timeout)', err);
        // Minimal fallback context
        return {
          profile: profilePreview || { name: 'Student', examType: 'General Study' },
          activeGoal: activeGoal ? { id: activeGoal.id, title: activeGoal.title } : null,
          weakConcepts: [], recentMistakes: [], struggles: [],
          masteryStats: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
          overdueCardsCount: 0, topOverdueCards: [], emotionalState: 'neutral', recentTopics: [],
          conceptHistory: [], cognitiveLoad: { level: 'normal', signals: [] },
          rootGapChains: [], currentSessionDurationMinutes: 0, sessionGoal: '', ragChunks: [],
        };
      });

  const retrievalQuery = tutorSurface && currentMaterialId
    ? [currentTopic, message, studyRoomIntent].filter(Boolean).join('\n')
    : message || '';

  const mindRagPromise = isSimpleMessage
    ? Promise.resolve({ ragContext: null, ragPromptBlock: '' })
    : withTimeout(
        buildMindRagContext({
          userId,
          message: retrievalQuery,
          subject: detectedIntent.subject || undefined,
          chapter: detectedIntent.topic || undefined,
          goalId: activeGoalId,
          chatSessionId: sessionId,
          selectedMaterialIds,
        }),
        explicitSourceRequest ? 15_000 : 8000,
        'mind_rag_timeout'
      ).catch((err) => {
        logger.error('Failed to get RAG context (or timeout)', err);
        return { ragContext: null, ragPromptBlock: '' };
      });

  const [semanticMemories, episodicMemories, mindContext, mindRag] = await Promise.all([
    withTimeout(memoryPromise, 1500).catch(() => [] as string[]),
    withTimeout(episodicMemoryPromise, 1500).catch(() => [] as string[]),
    withTimeout(mindContextPromise, 6000).catch(() => ({
      profile: { name: 'Student', examType: 'General Study', examDate: null, currentLevel: 'intermediate', learningStyle: 'visual', streakDays: 0, timezone: 'UTC', learnerStateVersion: 0 },
      activeGoal: null,
      currentSessionCard: null,
      commandTasks: [],
      recentStudySessions: [],
      weakConcepts: [], recentMistakes: [], struggles: [],
      masteryStats: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
      overdueCardsCount: 0, topOverdueCards: [], emotionalState: 'neutral', recentTopics: [], knownAnalogies: [],
      conceptHistory: [],
      cognitiveLoad: { level: 'normal', signals: [] },
      rootGapChains: [],
      currentSessionDurationMinutes: 0,
      sessionGoal: '',
      ragChunks: [],
      ragContext: null,
      studentModel: null,
      outcomeAnalytics: null,
    })),
    withTimeout(mindRagPromise, explicitSourceRequest ? 15_000 : 8000).catch(() => ({ ragContext: null, ragPromptBlock: '' }))
  ]) as [string[], string[], any, any];

  if (activeGoal && mindContext && !mindContext.activeGoal) {
    mindContext.activeGoal = {
      id: activeGoal.id,
      title: activeGoal.title,
      subject: activeGoal.subject ?? null,
      domain: activeGoal.domain ?? null,
      targetLevel: activeGoal.target_level ?? null,
      targetDate: activeGoal.target_date ?? activeGoal.deadline ?? null,
      progress: activeGoal.progress ?? null,
    };
  }

  const crossSessionMemories = [
    ...episodicMemories.map((memory) => `Episode: ${memory}`),
    ...semanticMemories,
  ].slice(0, 4);

  let systemPrompt = tutorSurface && currentMaterialId
    ? getStudyRoomSystemPrompt(mindContext, crossSessionMemories, detectedIntent.intent)
    : getMINDSystemPrompt(mindContext, crossSessionMemories, detectedIntent.intent);

  if (tutorSurface) {
    let resolvedExam = exam || '';
    let resolvedSubject = subject || activeGoal?.subject || '';
    let resolvedChapter = chapterSlug || activeGoal?.chapter || '';
    let resolvedTopic = currentTopic || topicSlug || '';
    let resolvedMicrotarget = 'General';

    if (activeGoalId && (!resolvedSubject || !resolvedChapter || !resolvedTopic)) {
      const { data: activeTopics } = await supabase
        .from('seeded_topics')
        .select('subject, chapter, topic, microtarget, status')
        .eq('user_id', userId)
        .eq('goal_id', activeGoalId)
        .eq('status', 'active')
        .limit(1);

      if (activeTopics && activeTopics[0]) {
        resolvedSubject = resolvedSubject || activeTopics[0].subject;
        resolvedChapter = resolvedChapter || activeTopics[0].chapter;
        resolvedTopic = resolvedTopic || activeTopics[0].topic;
        resolvedMicrotarget = activeTopics[0].microtarget;
      }
    }

    resolvedSubject = resolvedSubject || 'Not specified';
    resolvedChapter = resolvedChapter || 'Not specified';
    resolvedTopic = resolvedTopic || 'General';

    const { data: recentAttempts } = await supabase
      .from('practice_attempts')
      .select('is_correct, practice_items(question, concept_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const weakConceptsList = mindContext?.weakConcepts || [];
    const studyRoomIntentLabel = studyRoomIntent || 'general';
    const activeMaterialId = currentMaterialId || (selectedMaterialIds?.length ? selectedMaterialIds[0] : '');

    const tutorContextBlock = `
# STUDY ROOM CONTEXT
You are Cognition Study Room, an AI tutor that helps the user master their selected uploaded material.
The user leads the session. You adapt.
Use uploaded material first. If the answer is not present in the selected material, say so clearly before using general knowledge.
Help the user understand, practice, solve doubts, generate similar questions, detect weak areas, and review until mastery.
Do not force goals, targets, autonomous plans, or dashboards.

- Selected Material ID: ${activeMaterialId || 'None'}
- Current Topic: ${resolvedTopic}
- User Intent: ${studyRoomIntentLabel}
${resolvedExam ? `- Exam Context: ${resolvedExam}` : ''}
${activeGoalId ? `- Goal ID: ${activeGoalId}` : ''}
${resolvedChapter !== 'Not specified' ? `- Chapter: ${resolvedChapter}` : ''}
${resolvedSubject !== 'Not specified' ? `- Subject: ${resolvedSubject}` : ''}

## LEARNER'S WEAK AREAS
${weakConceptsList.length > 0
  ? weakConceptsList.map((c: any) => `- ${c.name} (Mastery: ${c.mastery})`).join('\n')
  : 'None identified yet.'}

## RECENT PRACTICE ATTEMPTS
${recentAttempts && recentAttempts.length > 0
  ? recentAttempts.map((a: any) => `- Question: "${a.practice_items?.question || 'Practice Question'}" | Concept: "${a.practice_items?.concept_name || 'N/A'}" | Result: ${a.is_correct ? 'CORRECT' : 'WRONG'}`).join('\n')
  : 'No recent practice attempts.'}

## INTENT-SPECIFIC BEHAVIOR
${studyRoomIntentLabel === 'teach' ? 'Explain the selected topic step-by-step from the material. Use examples. Ask one check question at the end.' : ''}
${studyRoomIntentLabel === 'quiz' ? 'Ask ONE question at a time from or inspired by the material. Check the answer strictly. Explain mistakes. Save weak areas if needed.' : ''}
${studyRoomIntentLabel === 'doubt' ? 'Identify what the user is confused about. Retrieve relevant source. Explain the missing concept. Offer a practice question.' : ''}
${studyRoomIntentLabel === 'generate_similar' || studyRoomIntentLabel === 'question_bank' ? 'Retrieve representative questions from the material. Analyze their style. Generate new questions matching the style. Clearly label them as generated.' : ''}
${studyRoomIntentLabel === 'diagnose' || studyRoomIntentLabel === 'diagnosis' ? 'Use actual session attempts. Summarize weak concepts with evidence. Suggest repair actions.' : ''}
${studyRoomIntentLabel === 'explain_source' || studyRoomIntentLabel === 'source_grounded' ? 'Explain the topic exclusively from the uploaded material. Cite specific passages.' : ''}
${studyRoomIntentLabel === 'harder_questions' ? 'Generate harder questions on the topic, increasing difficulty from the material baseline.' : ''}
${studyRoomIntentLabel === 'review' ? 'Revise key points, formulas, and definitions from the selected topic. Use rapid-fire recall checks.' : ''}

Be topic-aware. Focus explanations and questions on the Current Topic. Keep responses concise, supportive, and rigorous.
`;

    systemPrompt += `\n\n${tutorContextBlock}`;
  }

  const RAG_GROUNDING_RULES = `
# CITING INSTRUCTIONS

When referencing information from the source or its insights, you MUST ALWAYS include citations using the document IDs. This helps users track the specific content you're referencing.

## Citation Format
- For source content: [source:id] (e.g. [source:550e8400-e29b-41d4-a716-446655440000])

## IMPORTANT RULES

- **Do not make up document IDs or insight IDs.** Only use the IDs that are actually available in the RETRIEVED SOURCE CHUNKS.
- **Use complete IDs exactly as provided**, including their type prefix (source:, insight:, etc.). Do not modify the ID.
- **Always reference specific content** when citing to help users locate the information.
- Focus on the specific source. If SOURCE-GROUNDED MODE is explicit, answer exclusively from the retrieved source chunks.
- If explicit mode has no chunks, or the answer is not in the chunks, say exactly: "I could not find this in your uploaded material." Do not hallucinate.
- If SOURCE-GROUNDED MODE is implicit, use source chunks to improve accuracy when relevant, but answer naturally.
- For flashcards/MCQs generated from sources, include the citation [source:id] so the user can verify the facts.
`;

  if (mindRag?.ragPromptBlock) {
    systemPrompt += `\n\n${RAG_GROUNDING_RULES}\n\n${mindRag.ragPromptBlock}`;
    mindContext.ragContext = mindRag.ragContext;
    mindContext.ragChunks = mindRag.ragContext?.chunks || [];
  }

  return {
    profilePreview,
    detectedIntent,
    emotion,
    semanticMemories,
    episodicMemories,
    mindContext,
    mindRag,
    crossSessionMemories,
    systemPrompt
  };
}
