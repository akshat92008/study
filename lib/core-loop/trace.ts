import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export type CoreLoopStepStatus = 'success' | 'failed' | 'skipped';

export interface CoreLoopTraceStep {
  name: string;
  status: CoreLoopStepStatus;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  errorCode?: string;
}

export interface CoreLoopTrace {
  traceId: string;
  userId: string;
  goalId: string | null;
  action: string;
  startedAt: string;
  finishedAt?: string;
  steps: CoreLoopTraceStep[];
  result?: Record<string, unknown>;
}

export function createCoreLoopTrace(input: {
  userId: string;
  goalId?: string | null;
  action: string;
  traceId?: string;
}): CoreLoopTrace {
  return {
    traceId: input.traceId ?? randomUUID(),
    userId: input.userId,
    goalId: input.goalId ?? null,
    action: input.action,
    startedAt: new Date().toISOString(),
    steps: [],
  };
}

export function recordCoreLoopStep(trace: CoreLoopTrace, step: CoreLoopTraceStep): void {
  trace.steps.push(step);
}

export async function finishCoreLoopTrace(
  trace: CoreLoopTrace,
  result: Record<string, unknown>,
  supabase?: SupabaseClient
): Promise<CoreLoopTrace> {
  trace.finishedAt = new Date().toISOString();
  trace.result = result;

  const failed = trace.steps.some((step) => step.status === 'failed');
  const logContext = {
    traceId: trace.traceId,
    userId: trace.userId,
    goalId: trace.goalId,
    action: trace.action,
    steps: trace.steps,
    result,
  };
  if (failed) logger.error('Core loop action failed', logContext);
  else logger.info('Core loop action completed', logContext);

  if (supabase) {
    const { error } = await supabase.from('core_loop_traces').upsert({
      id: trace.traceId,
      user_id: trace.userId,
      goal_id: trace.goalId,
      action: trace.action,
      started_at: trace.startedAt,
      finished_at: trace.finishedAt,
      steps: trace.steps,
      result,
      status: failed ? 'failed' : 'success',
    }, { onConflict: 'id' });
    if (error) {
      logger.warn('Core loop trace persistence failed', {
        traceId: trace.traceId,
        error: error.message,
      });
    }
  }

  return trace;
}
