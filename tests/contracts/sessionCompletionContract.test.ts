/**
 * Module 5 Regression Tests
 * - Phase 5.2: Streak normalization (streak_days primary, new_streak fallback)
 * - Phase 5.3: completionKey idempotency guard in migrations
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Module 5 — session completion streak normalization', () => {
  /**
   * Simulate the RPC result and verify the normalizedStreak logic from session-completion.ts.
   * The logic is: rpcResult.streak_days ?? rpcResult.new_streak ?? 0
   */
  function normalizeStreak(rpcResult: { streak_days?: number; new_streak?: number }): number {
    return rpcResult.streak_days ?? rpcResult.new_streak ?? 0;
  }

  it('reads streak_days when present (new SQL schema)', () => {
    const rpcResult = { streak_days: 7 };
    expect(normalizeStreak(rpcResult)).toBe(7);
  });

  it('falls back to new_streak when streak_days is absent (legacy SQL)', () => {
    const rpcResult = { new_streak: 5 };
    expect(normalizeStreak(rpcResult)).toBe(5);
  });

  it('prefers streak_days over new_streak when both present', () => {
    const rpcResult = { streak_days: 10, new_streak: 3 };
    expect(normalizeStreak(rpcResult)).toBe(10);
  });

  it('returns 0 when both are absent', () => {
    const rpcResult = {};
    expect(normalizeStreak(rpcResult)).toBe(0);
  });
});

describe('Module 5 — completion idempotency in migrations', () => {
  const root = process.cwd();
  const migrationsDir = path.join(root, 'supabase', 'migrations');

  function getAllMigrationContent(): string {
    return fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
      .join('\n')
      .toLowerCase();
  }

  it('study_sessions has a completion_key column defined in migrations', () => {
    const content = getAllMigrationContent();
    const hasColumn =
      content.includes('completion_key') &&
      content.includes('study_sessions');
    expect(hasColumn).toBe(true);
  });

  it('session_cards has is_completed or isCompleted column for Phase 5.5', () => {
    const content = getAllMigrationContent();
    const hasCompleted =
      content.includes('is_completed') || content.includes('iscompleted');
    expect(hasCompleted).toBe(true);
  });

  it('complete_study_session RPC exists in migrations', () => {
    const content = getAllMigrationContent();
    expect(
      content.includes('function complete_study_session') ||
      content.includes('function public.complete_study_session')
    ).toBe(true);
  });

  it('session-completion service reads streak_days as primary field', () => {
    const serviceFile = path.join(root, 'lib', 'services', 'session-completion.ts');
    const content = fs.readFileSync(serviceFile, 'utf8');
    // The normalizedStreak line must read streak_days first
    expect(content).toContain('rpcResult.streak_days ?? rpcResult.new_streak');
  });

  it('session-card route returns 500 on upsert failure (persist-or-fail)', () => {
    const routeFile = path.join(root, 'app', 'api', 'dashboard', 'session-card', 'route.ts');
    const content = fs.readFileSync(routeFile, 'utf8');
    expect(content).toContain('session_card_persist_failed');
    expect(content).toContain('status: 500');
  });

  it('projector marks today completed instead of deleting for session_completed', () => {
    const projectorFile = path.join(root, 'lib', 'learner-state', 'projector.ts');
    const content = fs.readFileSync(projectorFile, 'utf8');
    expect(content).toContain('markSessionCardCompleted');
    expect(content).toContain("signal.type === 'session_completed'");
  });
});
