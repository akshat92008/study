import { createClient } from '@/lib/supabase/server';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { EpisodicMemoryService } from '@/lib/services/episodic-memory.service';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { buildMindRagContext } from '@/lib/rag/mind-rag';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
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

  const mindRagPromise = isSimpleMessage
    ? Promise.resolve({ ragContext: null, ragPromptBlock: '' })
    : withTimeout(
        buildMindRagContext({
          userId,
          message: message || '',
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

  let systemPrompt = getMINDSystemPrompt(mindContext, crossSessionMemories, detectedIntent.intent);

const RAG_GROUNDING_RULES = `
SOURCE-GROUNDED STUDY MATERIAL RULES:
- Uploaded sources are grounding evidence, not decoration.
- NEVER claim you cannot read, access, or view uploaded files or PDFs. The system has already parsed them and provided the relevant text chunks to you below. Act as if you have read the relevant parts of the document.
- If SOURCE-GROUNDED MODE is explicit, answer from the retrieved source chunks first.
- If explicit mode has no chunks, say: "I could not find this in your uploaded material." Then optionally provide a general answer separately if helpful.
- If SOURCE-GROUNDED MODE is implicit, use source chunks to improve accuracy when relevant, but answer naturally.
- Never invent citations.
- Cite only the provided source chunks.
- Use compact citations like [Source 1], [Source 2].
- Do not quote long copyrighted passages. Summarize/paraphrase unless a short exact phrase is necessary.
- For NCERT/NEET, prefer NCERT wording/facts when source chunks are available.
- For flashcards/MCQs generated from sources, mention that they are source-grounded and cite the source briefly.
`;

  if (mindRag?.ragPromptBlock) {
    systemPrompt += `\
\
${RAG_GROUNDING_RULES}\
\
${mindRag.ragPromptBlock}`;
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
