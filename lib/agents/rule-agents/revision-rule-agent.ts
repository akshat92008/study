import type { CheapAgentAction, LearningEvent } from '@/lib/agents/cheap-types';
import { correctItems, idPart, normalizeTopic, wrongItems } from './helpers';

export function runRevisionRuleAgent(event: LearningEvent): CheapAgentAction[] {
  const actions: CheapAgentAction[] = [];

  for (const item of wrongItems(event).slice(0, 20)) {
    const topic = normalizeTopic(item);
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'REVISION',
      actionType: 'create_revision_card_from_verified_mistake',
      riskLevel: 'safe',
      confidence: 0.82,
      reason: 'Wrong answer schedules a short recall item for the next day.',
      payload: {
        ...topic,
        conceptId: item.conceptId,
        conceptName: item.conceptName,
        priority: 'high',
        dueAt: addDaysIso(1),
        sourceType: 'cheap_agent_wrong_attempt',
        sourceId: idPart(item.sourceId ?? item.questionId, `${event.id ?? event.type}:revision`),
        front: topic.topic ? `Recall ${topic.topic}` : 'Recall the missed concept',
        back: 'Review the missed question, then answer one similar question without notes.',
      },
    });
  }

  if (wrongItems(event).length >= 2) {
    const first = wrongItems(event)[0];
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'REVISION',
      actionType: 'create_revision_card_from_verified_mistake',
      riskLevel: 'safe',
      confidence: 0.76,
      reason: 'Repeated wrong attempts increase revision priority for the topic.',
      payload: {
        ...normalizeTopic(first),
        conceptId: first.conceptId,
        conceptName: first.conceptName,
        priority: 'high',
        dueAt: addDaysIso(1),
        sourceType: 'cheap_agent_repeated_wrong',
        sourceId: idPart(first.sourceId ?? first.questionId, `${event.id ?? event.type}:priority`),
      },
    });
  }

  if (event.type === 'REVISION_COMPLETED' || event.type === 'REVISION_CARD_REVIEWED') {
    for (const item of correctItems(event).slice(0, 20)) {
      actions.push({
        userId: event.userId,
        eventId: event.id ?? null,
        agent: 'REVISION',
        actionType: 'create_revision_card_from_verified_mistake',
        riskLevel: 'safe',
        confidence: 0.72,
        reason: 'Completed revision pushes the item later using a simple spaced interval.',
        payload: {
          ...normalizeTopic(item),
          conceptId: item.conceptId,
          conceptName: item.conceptName,
          priority: 'medium',
          dueAt: addDaysIso(3),
          sourceType: 'cheap_agent_revision_completed',
          sourceId: idPart(item.sourceId ?? item.questionId, `${event.id ?? event.type}:completed`),
        },
      });
    }
  }

  return actions;
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}
