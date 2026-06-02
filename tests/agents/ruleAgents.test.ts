import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheapAgenticCycle } from '@/lib/agents/orchestrator';
import { runAtlasRuleAgent } from '@/lib/agents/rule-agents/atlas-rule-agent';
import { runAutopsyRuleAgent } from '@/lib/agents/rule-agents/autopsy-rule-agent';
import { runCommandRuleAgent } from '@/lib/agents/rule-agents/command-rule-agent';
import { runMemoryRuleAgent } from '@/lib/agents/rule-agents/memory-rule-agent';
import { runRevisionRuleAgent } from '@/lib/agents/rule-agents/revision-rule-agent';
import type { LearningEvent } from '@/lib/agents/cheap-types';

const wrongPracticeEvent: LearningEvent = {
  id: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000010',
  type: 'PRACTICE_ATTEMPT_RECORDED',
  payload: {
    items: [{
      attemptId: 'attempt-1',
      subject: 'Chemistry',
      chapter: 'Electrochemistry',
      topic: 'Nernst equation',
      isCorrect: false,
      timeTakenSeconds: 240,
      selectedAnswer: 'A',
      correctAnswer: 'B',
      questionId: 'question-1',
    }],
  },
};

describe('cheap rule agents', () => {
  it('creates MEMORY, ATLAS, AUTOPSY, REVISION, and COMMAND actions for a wrong practice attempt', () => {
    const actions = [
      ...runMemoryRuleAgent(wrongPracticeEvent),
      ...runAtlasRuleAgent(wrongPracticeEvent),
      ...runAutopsyRuleAgent(wrongPracticeEvent),
      ...runRevisionRuleAgent(wrongPracticeEvent),
      ...runCommandRuleAgent(wrongPracticeEvent),
    ];

    expect(actions.map((action) => action.agent)).toEqual(expect.arrayContaining([
      'MEMORY',
      'ATLAS',
      'AUTOPSY',
      'REVISION',
      'COMMAND',
    ]));
    expect(actions.map((action) => action.actionType)).toEqual(expect.arrayContaining([
      'record_learning_evidence',
      'update_mastery_from_evidence',
      'record_mistake_pattern',
      'create_revision_card_from_verified_mistake',
      'invalidate_session_card',
    ]));
  });

  it('updates mastery and marks a concept practiced for a correct attempt', () => {
    const actions = runAtlasRuleAgent({
      ...wrongPracticeEvent,
      payload: { items: [{ ...((wrongPracticeEvent.payload.items as any[])[0]), isCorrect: true }] },
    });

    expect(actions.map((action) => action.actionType)).toEqual(expect.arrayContaining([
      'update_mastery_from_evidence',
      'mark_concept_practiced',
    ]));
  });

  it('keeps AI primitives out of rule agents', () => {
    const dir = path.join(process.cwd(), 'lib', 'agents', 'rule-agents');
    const text = fs.readdirSync(dir)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
      .join('\n');

    expect(text).not.toMatch(/budgetedGenerate|route[A-Z]|generateJSON|streamText/);
  });

  it('cheap cycle exposes applied/proposed/skipped/failed counts', async () => {
    const result = await runCheapAgenticCycle({
      ...wrongPracticeEvent,
      userId: '',
    });
    expect(result.skipped).toBe(1);
  });
});
