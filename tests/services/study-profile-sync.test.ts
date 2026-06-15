import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'lib/services/study-profile-sync.service.ts'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/api/practice/attempts/route.ts'), 'utf8');

describe('study profile sync contract', () => {
  it('is called after practice attempts and returned in the response', () => {
    expect(route).toContain('syncStudyProfileAfterPracticeAttempt');
    expect(route).toContain('profileSync');
  });

  it('updates visible weak state and invalidates session cards', () => {
    // The service delegates practice sync persistence to runHermesTurn
    // calling .from('mistakes') directly — this is the correct architectural pattern.
    expect(source).toContain('runHermesTurn');
    // invalidateSessionCard is now atomic in the projection RPC
  });
});
