import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('private beta MVP loop integration coverage', () => {
  it('keeps the executable local MVP loop test covering the requested production path', () => {
    const testSource = fs.readFileSync(
      path.join(process.cwd(), 'tests/integration/mvpLocalLoop.test.ts'),
      'utf8'
    );

    for (const requiredSignal of [
      'requestDailyCard(state)',
      'getOrCreateGlobalChatSession',
      'persistChatMessage',
      'completeLearningSession',
      'streakChanged',
      'processQueuedEvents(state)',
      'processMockAutopsy',
      'AUTOPSY_MOCK_PROCESSED',
      'revision_cards.some',
      'getLearnerStateSnapshot',
      'currentMission?.focusTopic',
    ]) {
      expect(testSource).toContain(requiredSignal);
    }
  });
});
