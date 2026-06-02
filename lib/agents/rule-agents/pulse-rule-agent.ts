import type { CheapAgentAction, LearningEvent } from '@/lib/agents/cheap-types';
import { evidenceItems, normalizeTopic, wrongItems } from './helpers';

export function runPulseRuleAgent(event: LearningEvent): CheapAgentAction[] {
  const actions: CheapAgentAction[] = [];
  const mistakes = wrongItems(event);

  if (mistakes.length >= 3) {
    const topic = normalizeTopic(mistakes[0]);
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'PULSE',
      actionType: 'flag_student_risk',
      riskLevel: 'safe',
      confidence: 0.74,
      reason: 'Several wrong attempts in one event indicate study friction risk.',
      payload: {
        ...topic,
        riskType: 'frustration_risk',
        severity: 'medium',
        evidenceCount: mistakes.length,
      },
    });
  }

  const payload = event.payload ?? {};
  const lastActivityAt = typeof payload.lastActivityAt === 'string' ? Date.parse(payload.lastActivityAt) : NaN;
  if (Number.isFinite(lastActivityAt) && Date.now() - lastActivityAt > 2 * 24 * 60 * 60 * 1000) {
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'PULSE',
      actionType: 'flag_student_risk',
      riskLevel: 'safe',
      confidence: 0.7,
      reason: 'No recent learning activity for more than two days.',
      payload: {
        riskType: 'inactivity_risk',
        severity: 'medium',
        lastActivityAt: payload.lastActivityAt,
      },
    });
  }

  const missedRevisionCount = evidenceItems(event).filter((item) =>
    String(item.raw.status ?? '').toLowerCase() === 'missed'
  ).length;
  if (missedRevisionCount >= 2) {
    actions.push({
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'PULSE',
      actionType: 'flag_student_risk',
      riskLevel: 'safe',
      confidence: 0.72,
      reason: 'Repeated missed revision items indicate revision debt risk.',
      payload: {
        riskType: 'revision_debt_risk',
        severity: 'medium',
        evidenceCount: missedRevisionCount,
      },
    });
  }

  return actions;
}
