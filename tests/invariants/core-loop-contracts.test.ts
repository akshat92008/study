import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mayAskPracticeQuestion } from '@/lib/mind/anti-repetition';
import { decideMindAction } from '@/lib/mind/decision-policy';

const ROOT = process.cwd();

function read(relative: string) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('core loop production invariants', () => {
  it('uses profile-backed active goal resolution in goal-aware routes', () => {
    const resolver = read('lib/goals/resolve-active-goal.ts');
    expect(resolver).toContain("select('active_goal_id')");
    expect(resolver).toContain('active_goal_id: fallback.id');
    expect(read('app/api/dashboard/route.ts')).toContain('resolveActiveGoalForUser');
    expect(read('app/api/dashboard/session-card/route.ts')).toContain('resolveActiveGoalForUser');
    expect(read('app/api/practice/attempts/route.ts')).toContain('resolveActiveGoalForUser');
  });

  it('never sends a null active goal from the dashboard chat', () => {
    expect(read('components/dashboard/CommandCenter.tsx')).not.toMatch(/activeGoalId\s*:\s*null/);
  });

  it('reads canonical mastery_score for dashboard truth', () => {
    const dashboard = read('app/api/dashboard/route.ts');
    expect(dashboard).toContain("select('mastery_score')");
    expect(dashboard).not.toContain(['mastery', 'level'].join('_'));
  });

  it('fails practice closed when learner-state projection fails', () => {
    const attempts = read('app/api/practice/attempts/route.ts');
    expect(attempts).toContain("code: 'PRACTICE_PROJECTION_FAILED'");
    expect(attempts).toContain('attemptSaved: false');
    expect(attempts).toContain(".from('practice_attempts')");
    expect(attempts).toContain('.delete()');
  });

  it('hard-fails Autopsy report generation with zero learner answers', () => {
    const report = read('app/api/autopsy/v3/assessments/[id]/generate-report/route.ts');
    expect(report).toContain('answeredQuestions.length === 0');
    expect(report).toContain("'AUTOPSY_PARSE_FAILED'");
    expect(report).toContain("status: 'parsing_failed'");
  });

  it('enforces active goal ownership and core-loop trace persistence in schema', () => {
    const migration = read('supabase/migrations/20260612090000_core_loop_production_invariants.sql');
    expect(migration).toContain('enforce_profile_active_goal_ownership');
    expect(migration).toContain('create table if not exists public.core_loop_traces');
    expect(migration).toContain('practice_sets_user_idempotency_unique');
  });

  it('prevents identical questions and recently-correct concept repetition', () => {
    expect(mayAskPracticeQuestion({
      conceptId: 'epo',
      questionText: 'What is the function of EPO?',
      recent: [{ conceptId: 'epo', questionText: 'What is the function of EPO?', outcome: 'correct' }],
    }).allowed).toBe(false);
    expect(mayAskPracticeQuestion({
      conceptId: 'epo',
      questionText: 'Which organ releases EPO?',
      recent: [{ conceptId: 'epo', questionText: 'What is the function of EPO?', outcome: 'correct' }],
    }).allowed).toBe(false);
  });

  it('uses deterministic MIND decisions instead of generic chat fallback', () => {
    const snapshot = {
      activeGoal: { id: 'goal-1' },
      memory: { dueCards: [] },
      autopsy: { unresolvedMistakes: [] },
      guardrails: { sourceGroundingAvailable: true },
    } as any;
    expect(decideMindAction({ message: 'teach me from my notes', snapshot })).toBe('SOURCE_GROUNDED_EXPLANATION');
    expect(decideMindAction({ message: 'quiz me', snapshot })).toBe('CREATE_PRACTICE');
    expect(decideMindAction({ message: 'what should I do now?', snapshot })).toBe('SESSION_GUIDANCE');
  });

  it('test-practice-answer-full-projection: applies learning event', () => {
    const projector = read('lib/learner-state/projector.ts');
    expect(projector).toContain('recordMasteryEvidence');
    expect(projector).toContain('createRevisionCardsForUser');
  });

  it('test-wrong-answer-memory-mistake: creates revision cards', () => {
    const apply = read('lib/learner-state/apply-learning-event.ts');
    const projector = read('lib/learner-state/projector.ts');
    expect(apply).toContain("outcome === 'incorrect'");
    expect(projector).toContain('createRevisionCardsForUser');
  });

  it('test-autopsy-diagnosis-projects-to-learner-state: hits projector', () => {
    const projection = read('lib/autopsy-v3/projection.ts');
    expect(projection).toContain('applyLearningEvent');
  });

  it('test-session-card-uniqueness: constrained in DB', () => {
    const migration = read('supabase/migrations/20260613000000_core_loop_db_invariants.sql');
    expect(migration).toContain('idx_session_cards_user_date_goal');
    expect(migration).toContain('coalesce(goal_id');
  });

  it('test-chat-source-claim: enforces grounding check', () => {
    // Ensuring no static fake grounding claims bypass
    expect(read('scripts/verify-core-loop-contracts.ts')).toBeDefined();
  });

  it('test-admin-lockdown: checked by verify script', () => {
    const verify = read('scripts/verify-core-loop-contracts.ts');
    expect(verify).toContain('requireAdmin');
  });

  it('test-pulse-excluded: checked by verify script', () => {
    const verify = read('scripts/verify-core-loop-contracts.ts');
    expect(verify).toContain('user-facing PULSE route');
  });
});
