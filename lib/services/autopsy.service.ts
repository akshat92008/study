/**
 * @deprecated lib/services/autopsy.service.ts — LEGACY STUB
 *
 * This file is the old autopsy service that performed direct table inserts,
 * bypassing the validated `ingest_mock_autopsy` RPC. It has been superseded by:
 *
 *   lib/engines/autopsy-engine.ts → processMockAutopsy()
 *
 * The canonical pipeline:
 *   1. app/api/autopsy/ingest/route.ts — receives upload, budget-checks
 *   2. lib/engines/autopsy-engine.ts  — 2-pass AI extract + diagnose
 *   3. supabase RPC: ingest_mock_autopsy — atomic insert, confidence routing,
 *      event publication (AUTOPSY_MOCK_PROCESSED)
 *   4. lib/events/worker.ts — routes event to consumers:
 *      - AtlasConsumer  → mastery update (verified_mistake only)
 *      - MemoryConsumer → revision card creation (verified_mistake only)
 *      - CommandConsumer → remediation tasks (verified_mistake only)
 *
 * The legacy processAutopsy() function is intentionally disabled to prevent
 * accidental invocation that would bypass confidence gating and directly
 * mutate the mistakes table without event publication.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export type RawQuestion = {
  questionNumber: number;
  subject: string;
  chapter?: string;
  subtopic?: string;
  difficulty?: string;
  questionText: string;
  correctAnswer: string;
  studentAnswer?: string;
  timeSpentSeconds?: number;
};

/**
 * @deprecated Use processMockAutopsy from lib/engines/autopsy-engine.ts instead.
 * This function is intentionally disabled to prevent bypassing the validated pipeline.
 */
export async function processAutopsy(_params: {
  userId: string;
  testName: string;
  examType?: string;
  rawFile?: File;
  manualQuestions?: RawQuestion[];
}): Promise<never> {
  throw new Error(
    '[DEPRECATED] processAutopsy() has been disabled. ' +
    'Use processMockAutopsy() from lib/engines/autopsy-engine.ts instead, ' +
    'which routes through the validated ingest_mock_autopsy RPC with confidence gating.'
  );
}

/** @deprecated This function is kept only for read-only analytics use. */
export async function getRecentMessages(userId: string, limit = 20) {
  logger.warn('getRecentMessages() called from deprecated autopsy.service.ts', { userId });
  return [] as any;
}

// Legacy class kept for any surviving import references — methods throw.
export class AutopsyService {
  async getLatestAutopsy(userId: string): Promise<any> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('mock_autopsies')
      .select('test_name, current_score, potential_score, recoverable_marks, total_questions, correct_count, incorrect_count, unattempted_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }
}

