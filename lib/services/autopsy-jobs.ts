import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AutopsyNeedsUserInputError,
  processMockAutopsy,
} from '@/lib/engines/autopsy-engine';
import {
  commitBudgetUsage,
  releaseBudgetReservation,
  reserveBudgetForModelCall,
  type BudgetReservation,
} from '@/lib/ai/cost-guard';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';
import { getPromptVersion } from '@/lib/ai/prompt-version';

export type AutopsyJobFileData =
  | { kind: 'text'; text: string }
  | { kind: 'inline'; mimeType: string; data: string };

export interface CreateAutopsyJobInput {
  userId: string;
  fileData: AutopsyJobFileData;
  testName: string;
  examType: string;
  customScoring?: { correctMarks: number; negativeMarks: number };
  idempotencyKey?: string | null;
  source?: string;
  client?: any;
}

export interface AutopsyJobRecord {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_user_input';
  result_autopsy_id: string | null;
  error_message: string | null;
}

function stableJobKey(input: CreateAutopsyJobInput): string {
  const hash = createHash('sha256');
  hash.update(input.userId);
  hash.update('\n');
  hash.update(input.idempotencyKey?.trim() || '');
  hash.update('\n');
  hash.update(input.testName);
  hash.update('\n');
  hash.update(input.examType);
  hash.update('\n');
  hash.update(input.fileData.kind);
  hash.update('\n');
  hash.update(input.fileData.kind === 'text' ? input.fileData.text : input.fileData.data);
  return `autopsy_job:${hash.digest('hex')}`;
}

function estimatePromptTokens(fileData: AutopsyJobFileData): number {
  if (fileData.kind === 'text') return Math.max(1, Math.ceil(fileData.text.length / 4));
  return Math.max(1, Math.ceil(Buffer.byteLength(fileData.data, 'base64') / 4));
}

export async function createAutopsyJob(input: CreateAutopsyJobInput): Promise<AutopsyJobRecord> {
  const supabase = input.client ?? createAdminClient();
  const idempotencyKey = stableJobKey(input);

  const { data: existing, error: existingError } = await supabase
    .from('autopsy_jobs')
    .select('id, status, result_autopsy_id, error_message')
    .eq('user_id', input.userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check AUTOPSY job idempotency: ${existingError.message}`);
  }

  if (existing?.id) {
    logger.info('Autopsy job idempotency hit', {
      userId: input.userId,
      jobId: existing.id,
      status: existing.status,
    });
    return existing;
  }

  const { data: created, error } = await supabase
    .from('autopsy_jobs')
    .insert({
      user_id: input.userId,
      status: 'pending',
      test_name: input.testName,
      exam_type: input.examType,
      idempotency_key: idempotencyKey,
      payload: {
        // TODO(production): Consider migrating fileData to Supabase Storage
        // instead of JSONB base64 to reduce row size, despite 20MB cap.
        fileData: input.fileData,
        customScoring: input.customScoring ?? null,
      },
      source: input.source ?? 'autopsy_ingest',
    })
    .select('id, status, result_autopsy_id, error_message')
    .single();

  if (error || !created?.id) {
    throw new Error(`Failed to create AUTOPSY job: ${error?.message ?? 'missing id'}`);
  }

  await EventDispatcher.publish({
    user_id: input.userId,
    type: 'AUTOPSY_UPLOAD_RECEIVED',
    data: { jobId: created.id },
    metadata: { source: input.source ?? 'autopsy_ingest' },
    idempotency_key: `autopsy_upload:${created.id}`,
  });

  logger.info('Autopsy job pending', {
    userId: input.userId,
    jobId: created.id,
    source: input.source ?? 'autopsy_ingest',
  });

  return created;
}

export async function processAutopsyJob(userId: string, jobId: string): Promise<AutopsyJobRecord | null> {
  if (!jobId || typeof jobId !== 'string') {
    throw new Error('AUTOPSY_UPLOAD_RECEIVED missing jobId');
  }

  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('autopsy_jobs')
    .select('id, user_id, status, test_name, exam_type, payload, idempotency_key, result_autopsy_id, error_message, retry_count')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load AUTOPSY job: ${error.message}`);
  if (!job) return null;
  if (job.status === 'completed' || job.status === 'needs_user_input') {
    return {
      id: job.id,
      status: job.status,
      result_autopsy_id: job.result_autopsy_id ?? null,
      error_message: job.error_message ?? null,
    };
  }

  const payload = job.payload ?? {};
  const fileData = payload.fileData as AutopsyJobFileData | undefined;
  if (!fileData || (fileData.kind !== 'text' && fileData.kind !== 'inline')) {
    throw new Error('AUTOPSY job payload is missing fileData');
  }

  await supabase
    .from('autopsy_jobs')
    .update({
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', job.id)
    .eq('user_id', userId);

  let budgetReservation: BudgetReservation | null = null;
  const estimatedPromptTokens = estimatePromptTokens(fileData);
  const model = fileData.kind === 'text' ? 'router:flash+pro' : 'router:multimodal+pro';

  try {
    budgetReservation = await reserveBudgetForModelCall(
      userId,
      'autopsy',
      model,
      estimatedPromptTokens,
      2500
    );

    const result = await processMockAutopsy(
      userId,
      fileData,
      job.test_name ?? 'Mock Test Autopsy',
      job.exam_type ?? 'General Study',
      payload.customScoring ?? undefined,
      supabase,
      job.idempotency_key
    );

    await commitBudgetUsage(budgetReservation.reservationId, {
      promptTokens: estimatedPromptTokens,
      completionTokens: Math.ceil(JSON.stringify(result).length / 4),
      route: 'event_worker:autopsy_job',
      promptVersion: getPromptVersion('autopsy'),
      promptFamily: 'autopsy_extract',
      promptSource: 'autopsy_job_worker',
    });

    const { data: updated } = await supabase
      .from('autopsy_jobs')
      .update({
        status: 'completed',
        result_autopsy_id: result.autopsyId,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', job.id)
      .eq('user_id', userId)
      .select('id, status, result_autopsy_id, error_message')
      .single();

    logger.info('Autopsy job completed', { userId, jobId: job.id, autopsyId: result.autopsyId });
    return {
      id: updated?.id ?? job.id,
      status: 'completed',
      result_autopsy_id: updated?.result_autopsy_id ?? result.autopsyId,
      error_message: updated?.error_message ?? null,
    };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);

    if (budgetReservation) {
      await releaseBudgetReservation(budgetReservation.reservationId, message);
    }

    if (err instanceof AutopsyNeedsUserInputError) {
      const { data: updated } = await supabase
        .from('autopsy_jobs')
        .update({
          status: 'needs_user_input',
          error_message: message,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('user_id', userId)
        .select('id, status, result_autopsy_id, error_message')
        .single();

      logger.info('Autopsy job needs user input', { userId, jobId: job.id, reason: message });
      return {
        id: updated?.id ?? job.id,
        status: 'needs_user_input',
        result_autopsy_id: updated?.result_autopsy_id ?? null,
        error_message: updated?.error_message ?? message,
      };
    }

    await supabase
      .from('autopsy_jobs')
      .update({
        status: 'failed',
        retry_count: (job.retry_count ?? 0) + 1,
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('user_id', userId);

    logger.warn('Autopsy job failed', { userId, jobId: job.id, error: message });
    throw err;
  }
}
