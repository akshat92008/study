import type { CheapAgentAction, LearningEvent } from '@/lib/agents/cheap-types';
import { idPart, normalizeTopic, wrongItems } from './helpers';

export function runAutopsyRuleAgent(event: LearningEvent): CheapAgentAction[] {
  const mistakes = wrongItems(event);
  if (mistakes.length === 0) return [];

  return mistakes.slice(0, 20).map((item) => {
    const time = item.timeTakenSeconds ?? null;
    const selected = item.selectedAnswer?.trim();
    const patternType = !selected
      ? 'avoidance'
      : time !== null && time <= 8
        ? 'guessing'
        : time !== null && time >= 180
          ? 'conceptual_gap'
          : /calc|numerical|physics|chem/i.test(`${item.raw.question ?? ''} ${item.raw.chapter ?? ''}`)
            ? 'calculation_error'
            : 'conceptual_gap';

    return {
      userId: event.userId,
      eventId: event.id ?? null,
      agent: 'AUTOPSY',
      actionType: 'record_mistake_pattern',
      riskLevel: 'safe',
      confidence: patternType === 'conceptual_gap' ? 0.66 : 0.74,
      reason: `Rule-based mistake classification detected ${patternType}.`,
      payload: {
        ...normalizeTopic(item),
        conceptId: item.conceptId,
        conceptName: item.conceptName,
        patternType,
        severity: time !== null && time >= 180 ? 0.7 : 0.55,
        sourceId: idPart(item.sourceId ?? item.questionId, `${event.id ?? event.type}:mistake`),
        raw: item.raw,
      },
    };
  });
}
