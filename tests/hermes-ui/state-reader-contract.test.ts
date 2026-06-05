import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'lib/hermes/ui/state-reader.ts'), 'utf8');

describe('Hermes state reader contract', () => {
  it('does not load source chunks or full documents', () => {
    expect(source).not.toContain('study_material_chunks');
    expect(source).not.toContain(".select('text");
    expect(source).not.toContain('.select("text');
  });

  it('scopes user tables by user_id and goal_id', () => {
    expect(source).toContain(".eq('user_id', userId)");
    expect(source).toContain(".eq('goal_id', activeGoal.id)");
  });
});
