import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'lib/hermes/ui/mission-service.ts'), 'utf8');

describe('mission self-healing contract', () => {
  it('keeps missions scoped to the goal and avoids duplicates', () => {
    expect(source).toContain('getMicrotasksForDate(userId, date, goalId)');
    expect(source).toContain('if (existing.length > 0)');
    expect(source).toContain('goal_id: goal.id');
  });

  it('uses seeded topics before goal-aware fallback', () => {
    expect(source).toContain('loadSeededTopics');
    expect(source).toContain('seedTopicsForGoal');
    expect(source).toContain('fallbackTopics');
  });
});
