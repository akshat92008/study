import type { CheapAgentAction, LearningEvent } from '@/lib/agents/cheap-types';
import { correctItems, evidenceItems, idPart, normalizeTopic, wrongItems } from './helpers';

export function runAtlasRuleAgent(event: LearningEvent): CheapAgentAction[] {
  if (!event.type.includes('PRACTICE') && !event.type.includes('REVISION') && !event.type.includes('AUTOPSY') && !event.type.includes('MIND_TUTOR')) {
    return [];
  }

  const actions: CheapAgentAction[] = [];
  for (const item of evidenceItems(event).slice(0, 20)) {
    if (item.isCorrect == null && event.type !== 'REVISION_COMPLETED') continue;

    const topic = normalizeTopic(item);
    const delta = item.isCorrect === true
      ? 0.04
      : item.isCorrect === false
        ? -0.07
        : 0.02;
    const sourceId = idPart(item.sourceId ?? item.questionId, `${event.id ?? event.type}:atlas`);

    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'ATLAS',
      actionType: 'update_mastery_from_evidence',
      riskLevel: 'safe',
      confidence: 0.78,
      reason: item.isCorrect === false
        ? 'Wrong attempt lowers topic mastery with a small deterministic delta.'
        : 'Correct or completed practice increases topic mastery with a small deterministic delta.',
      payload: {
        ...topic,
        conceptId: item.conceptId,
        conceptName: item.conceptName,
        delta,
        isCorrect: item.isCorrect,
        sourceId,
        sourceType: event.type.toLowerCase(),
      },
    });
  }

  for (const item of correctItems(event).slice(0, 20)) {
    const topic = normalizeTopic(item);
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'ATLAS',
      actionType: 'mark_concept_practiced',
      riskLevel: 'safe',
      confidence: 0.82,
      reason: 'Correct attempt confirms the concept was practiced.',
      payload: {
        ...topic,
        conceptId: item.conceptId,
        conceptName: item.conceptName,
        sourceId: idPart(item.sourceId ?? item.questionId, `${event.id ?? event.type}:practice`),
      },
    });
  }

  for (const item of wrongItems(event).slice(0, 20)) {
    const topic = normalizeTopic(item);
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'ATLAS',
      actionType: 'tag_weak_topic',
      riskLevel: 'safe',
      confidence: 0.76,
      reason: 'Wrong attempt marks this topic as weak for near-term planning.',
      payload: {
        ...topic,
        conceptId: item.conceptId,
        conceptName: item.conceptName,
        sourceId: idPart(item.sourceId ?? item.questionId, `${event.id ?? event.type}:weak`),
      },
    });
  }

  return actions;
}
