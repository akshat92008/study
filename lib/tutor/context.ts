import type { ActiveLearningContext } from '@/lib/learning-context/active-context';
import { getModeConfig } from './modes';
import { logger } from '@/lib/utils/logger';

export type TutorRetrievalPacket = {
  systemPromptAddendum: string;
  sourceChunkIds: string[];
  activeConceptId: string | null;
};

export function buildTutorRetrievalPacket(context: ActiveLearningContext): TutorRetrievalPacket {
  if (!context.goalId) {
    return {
      systemPromptAddendum: 'No active goal set. The user is studying from uploaded material. Help them learn, practice, and solve doubts from the selected material. Do not require or prompt the user to select a goal.',
      sourceChunkIds: context.sourceChunkIds ?? [],
      activeConceptId: context.topicId ?? null,
    };
  }

  const weakAreasStr = context.recentWeakAreas.length > 0
    ? context.recentWeakAreas.map(wa => `- ${wa.concept_tag} (${wa.severity}): Missing ${wa.missing_points.join(', ')}`).join('\n')
    : 'None yet.';

  const recentQsStr = context.recentQuestions.length > 0
    ? context.recentQuestions.slice(0, 5).map(q => `- ${q}`).join('\n')
    : 'None yet.';

  const modeConfig = getModeConfig(context.mode);

  const addendum = `
=== TUTOR PERSONA & GOAL ===
${modeConfig.systemPromptBase}

=== ACTIVE LEARNING CONTEXT ===
Mode: ${context.mode.toUpperCase()}
Subject: ${context.subjectId || 'Unknown'}
Chapter: ${context.chapterId || 'Unknown'}
Current Topic: ${context.topicId || 'General'}
Date: ${context.currentDate}

=== DIAGNOSTIC STATE ===
Recent Weak Areas:
${weakAreasStr}

Recent Questions Asked:
${recentQsStr}

=== RULES ===
1. You MUST stay strictly within the domain of the Chapter and Current Topic.
2. DO NOT hallucinate facts outside the student's uploaded material or the RETRIEVED SOURCE CHUNKS.
3. If mode is REPAIR or AUTOPSY, prioritize addressing the Recent Weak Areas.
4. Follow the CITING INSTRUCTIONS exactly if source chunks are provided in the context.
5. Ask one question at a time.
  `.trim();

  logger.info('tutor_retrieval_packet_built', {
    userId: context.userId,
    goalId: context.goalId,
    mode: context.mode,
  });

  return {
    systemPromptAddendum: addendum,
    sourceChunkIds: context.sourceChunkIds,
    activeConceptId: context.topicId,
  };
}

