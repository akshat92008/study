/**
 * tests/components/sessionCompletion.test.ts
 *
 * Contract: Session completion (e.g. from DailySessionCard) must hit
 * the canonical /api/dashboard/complete-session endpoint to ensure
 * learning evidence and streaks are properly updated.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();

describe('Session Completion Contracts', () => {
  it('DailySessionCard calls /api/dashboard/complete-session on handleEnd', () => {
    const cardPath = path.join(root, 'components', 'chat', 'DailySessionCard.tsx');
    const cardContent = fs.readFileSync(cardPath, 'utf8');
    
    // The handleEnd function must be async and call fetch with the correct endpoint
    expect(cardContent).toMatch(/const handleEnd = async \(\) => {/);
    expect(cardContent).toContain("fetch('/api/dashboard/complete-session'");
    expect(cardContent).toContain("method: 'POST'");
  });
});
