import type { CheapAgentAction, LearningEvent } from '@/lib/agents/cheap-types';
import { normalizeTopic, wrongItems } from './helpers';

export function runCommandRuleAgent(event: LearningEvent): CheapAgentAction[] {
  const mistakes = wrongItems(event);
  const actions: CheapAgentAction[] = [];

  if (mistakes.length > 0) {
    const first = mistakes[0];
    const topic = normalizeTopic(first);
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'COMMAND',
      actionType: 'invalidate_session_card',
      riskLevel: 'safe',
      confidence: 0.8,
      reason: 'A new weak topic appeared, so the current mission should be refreshed before reuse.',
      payload: {
        ...topic,
        reasonCode: 'new_weak_topic',
        missionDate: new Date().toISOString().slice(0, 10),
      },
    });

    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'COMMAND',
      actionType: 'increase_topic_priority',
      riskLevel: 'safe',
      confidence: 0.78,
      reason: 'Wrong attempts increase the topic priority for daily planning.',
      payload: {
        ...topic,
        priority: mistakes.length >= 2 ? 'high' : 'medium',
        sourceEventId: event.id ?? null,
      },
    });
  }

  if (event.type.includes('MOCK') || event.type === 'TEST_ANALYSIS_COMPLETED') {
    const first = mistakes[0];
    const topic = first ? normalizeTopic(first) : {
      subject: stringOrNull(event.payload.subject),
      chapter: stringOrNull(event.payload.chapter),
      topic: stringOrNull(event.payload.topic),
    };
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'COMMAND',
      actionType: 'replace_daily_plan',
      riskLevel: 'medium',
      confidence: 0.62,
      reason: 'A mock/test result can justify a plan change, but replacement needs approval.',
      payload: {
        blocks: [
          {
            type: 'revision',
            subject: topic.subject,
            chapter: topic.chapter,
            topic: topic.topic,
            durationMinutes: 45,
            reason: 'Recent test evidence changed priority.',
          },
        ],
        generatedBy: 'COMMAND_RULE_AGENT',
        requiresApproval: true,
      },
    });
  }

  return actions;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
