import type { CheapAgentAction, LearningEvent } from '@/lib/agents/cheap-types';
import { evidenceItems, idPart, isLearningSignal, normalizeTopic, scoreForItem, sourceTypeForEvent } from './helpers';

export function runMemoryRuleAgent(event: LearningEvent): CheapAgentAction[] {
  if (!isLearningSignal(event)) return [];

  return evidenceItems(event)
    .slice(0, 20)
    .map((item, index) => {
      const topic = normalizeTopic(item);
      const sourceType = sourceTypeForEvent(event);
      const sourceId = idPart(item.sourceId, `${event.id ?? event.type}:${index}`);
      const score = scoreForItem(item);
      return {
        userId: event.userId,
        eventId: event.id ?? null,
        agent: 'MEMORY',
        actionType: 'record_learning_evidence',
        riskLevel: 'safe',
        confidence: event.type === 'CHAT_LEARNING_SIGNAL' ? 0.65 : 0.8,
        reason: `${sourceType} provides structured evidence for the learner model.`,
        payload: {
          sourceType,
          sourceId,
          subject: topic.subject,
          chapter: topic.chapter,
          topic: topic.topic,
          evidenceType: score === null ? sourceType : score >= 0.5 ? 'positive_signal' : 'negative_signal',
          score,
          raw: item.raw,
        },
      };
    });
}
