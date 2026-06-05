import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

type OwnershipTarget =
  | 'assessment'
  | 'autopsy_report'
  | 'material'
  | 'revision_card'
  | 'chat_session'
  | 'goal'
  | 'session_card'
  | 'practice_attempt';

const OWNERSHIP_TABLES: Record<OwnershipTarget, string> = {
  assessment: 'assessments',
  autopsy_report: 'autopsy_reports',
  material: 'study_materials',
  revision_card: 'revision_cards',
  chat_session: 'chat_sessions',
  goal: 'learning_goals',
  session_card: 'session_cards',
  practice_attempt: 'practice_attempts',
};

export class OwnershipError extends Error {
  readonly status = 404;
  readonly code = 'ownership_error';
  constructor(readonly target: OwnershipTarget, readonly id: string) {
    super('Resource not found.');
  }
}

async function assertOwns(table: string, userId: string, id: string): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new OwnershipError(table as OwnershipTarget, id);
}

export const assertOwnsAssessment = (userId: string, assessmentId: string) =>
  assertOwns(OWNERSHIP_TABLES.assessment, userId, assessmentId);

export const assertOwnsAutopsyReport = (userId: string, reportId: string) =>
  assertOwns(OWNERSHIP_TABLES.autopsy_report, userId, reportId);

export const assertOwnsMaterial = (userId: string, materialId: string) =>
  assertOwns(OWNERSHIP_TABLES.material, userId, materialId);

export const assertOwnsRevisionCard = (userId: string, cardId: string) =>
  assertOwns(OWNERSHIP_TABLES.revision_card, userId, cardId);

export const assertOwnsChatSession = (userId: string, sessionId: string) =>
  assertOwns(OWNERSHIP_TABLES.chat_session, userId, sessionId);

export const assertOwnsGoal = (userId: string, goalId: string) =>
  assertOwns(OWNERSHIP_TABLES.goal, userId, goalId);

export const assertOwnsSessionCard = (userId: string, cardId: string) =>
  assertOwns(OWNERSHIP_TABLES.session_card, userId, cardId);

export const assertOwnsPracticeAttempt = (userId: string, attemptId: string) =>
  assertOwns(OWNERSHIP_TABLES.practice_attempt, userId, attemptId);
