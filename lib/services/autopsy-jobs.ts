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
import { consumeUsageLimit } from '@/lib/utils/billing';
import { logger } from '@/lib/utils/logger';
import { getPromptVersion } from '@/lib/ai/prompt-version';
import { recordAgentAction } from '@/lib/agents/agent-runtime';

export type AutopsyJobFileData =
  | { kind: 'text'; text: string }
  | { kind: 'inline'; mimeType: string; data: string };

export interface CreateAutopsyJobInput {
  userId: string;
  fileData: AutopsyJobFileData;
  testName: string;
  examType: string;
  customScoring?: { correctMarks: number; negativeMarks: number };
  goalId?: string | null;
  chatSessionId?: string | null;
  idempotencyKey?: string | null;
  source?: string;
  client?: any;
}

export interface AutopsyJobRecord {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'needs_user_input' | 'dead_letter';
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
    throw new Error(`Failed to check Mistake Review job idempotency: ${existingError.message}`);
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
      status: 'queued',
      test_name: input.testName,
      exam_type: input.examType,
      idempotency_key: idempotencyKey,
      payload: {
        fileData: input.fileData.kind === 'inline'
          ? { kind: 'storage', mimeType: input.fileData.mimeType, path: `autopsy-evidence/${input.userId}/${idempotencyKey.replace(/:/g, '_')}` }
          : input.fileData,
        customScoring: input.customScoring ?? null,
        goalId: input.goalId ?? null,
        chatSessionId: input.chatSessionId ?? null,
      },
      goal_id: input.goalId ?? null,
      chat_session_id: input.chatSessionId ?? null,
      source: input.source ?? 'autopsy_ingest',
    })
    .select('id, status, result_autopsy_id, error_message')
    .single();

  if (error || !created?.id) {
    throw new Error(`Failed to create Mistake Review job: ${error?.message ?? 'missing id'}`);
  }

  if (input.fileData.kind === 'inline') {
    const storagePath = `${input.userId}/${idempotencyKey.replace(/:/g, '_')}`;
    const buffer = Buffer.from(input.fileData.data, 'base64');
    const { error: uploadError } = await supabase.storage.from('autopsy-evidence').upload(storagePath, buffer, {
      contentType: input.fileData.mimeType,
      upsert: true,
    });
    if (uploadError) {
      logger.error('Failed to upload autopsy evidence to storage', uploadError);
      throw new Error(`Failed to upload Mistake Review evidence: ${uploadError.message}`);
    }
  }

  await EventDispatcher.publish({
    user_id: input.userId,
    type: 'AUTOPSY_UPLOAD_RECEIVED',
    data: { jobId: created.id, goalId: input.goalId ?? null, chatSessionId: input.chatSessionId ?? null },
    metadata: { source: input.source ?? 'autopsy_ingest', goalId: input.goalId ?? null, chatSessionId: input.chatSessionId ?? null },
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
    throw new Error('Mistake Review upload event is missing jobId');
  }

  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('autopsy_jobs')
    .select('id, user_id, status, test_name, exam_type, payload, goal_id, chat_session_id, idempotency_key, result_autopsy_id, error_message, retry_count')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load Mistake Review job: ${error.message}`);
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
  let fileData = payload.fileData as any;
  if (!fileData) {
    throw new Error('Mistake Review job payload is missing fileData');
  }

  if (fileData.kind === 'storage') {
    const storagePath = fileData.path.replace('autopsy-evidence/', '');
    const { data: downloaded, error: downloadError } = await supabase.storage.from('autopsy-evidence').download(storagePath);
    if (downloadError || !downloaded) {
      throw new Error(`Failed to download Mistake Review evidence: ${downloadError?.message ?? 'missing file'}`);
    }
    const buffer = await downloaded.arrayBuffer();
    fileData = {
      kind: 'inline',
      mimeType: fileData.mimeType,
      data: Buffer.from(buffer).toString('base64'),
    };
  }

  if (fileData.kind !== 'text' && fileData.kind !== 'inline') {
    throw new Error('Mistake Review job payload has invalid fileData kind');
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

  const usageGate = await consumeUsageLimit(userId, 'expensive_operations_daily');
  if (!usageGate.allowed) {
    await supabase
      .from('autopsy_jobs')
      .update({
        status: 'failed',
        error_message: 'Daily expensive operations limit reached.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('user_id', userId);
    throw new Error('Daily expensive operations limit reached.');
  }

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
      job.test_name ?? 'Assessment Autopsy',   // universal: not "Mock Test" by default

      job.exam_type ?? 'General Study',
      payload.customScoring ?? undefined,
      supabase,
      job.idempotency_key
    );

    const goalId = job.goal_id ?? payload.goalId ?? null;
    const chatSessionId = job.chat_session_id ?? payload.chatSessionId ?? null;
    if (goalId || chatSessionId) {
      await Promise.all([
        supabase
          .from('mock_autopsies')
          .update({ goal_id: goalId, chat_session_id: chatSessionId })
          .eq('id', result.autopsyId)
          .eq('user_id', userId),
        supabase
          .from('autopsy_questions')
          .update({ goal_id: goalId, chat_session_id: chatSessionId })
          .eq('autopsy_id', result.autopsyId)
          .eq('user_id', userId),
        supabase
          .from('mistakes')
          .update({ goal_id: goalId, chat_session_id: chatSessionId })
          .eq('source_autopsy_id', result.autopsyId)
          .eq('user_id', userId),
      ]).catch((err) => logger.warn('Failed to attach goal context to Mistake Review rows', { userId, jobId: job.id, err }));
    }

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
        goal_id: goalId,
        chat_session_id: chatSessionId,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', job.id)
      .eq('user_id', userId)
      .select('id, status, result_autopsy_id, error_message')
      .single();

    if (result.needsReviewQuestions?.length) {
      for (const q of result.needsReviewQuestions) {
        await recordAgentAction({
          userId,
          agentName: 'autopsy',
          actionType: 'uncertain_autopsy_mistake',
          targetType: 'autopsy',
          targetId: result.autopsyId,
          status: 'pending_approval',
          approvalStatus: 'pending',
          riskLevel: 'requires_approval',
          confidence: q.ocrConfidence ? q.ocrConfidence / 100 : 0.5,
          evidence: { questionNumber: q.questionNumber, subject: q.subject, chapter: q.chapter },
          idempotencyKey: `autopsy_needs_review:${result.autopsyId}:${q.questionNumber}`,
        }, { client: supabase }).catch(err => logger.warn('Failed to record AUTOPSY action', err));
      }
    }

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

    const newRetryCount = (job.retry_count ?? 0) + 1;
    const isDeadLetter = newRetryCount > 2;

    await supabase
      .from('autopsy_jobs')
      .update({
        status: isDeadLetter ? 'dead_letter' : 'failed',
        retry_count: newRetryCount,
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('user_id', userId);

    logger.warn(`Autopsy job ${isDeadLetter ? 'dead_letter' : 'failed'}`, { userId, jobId: job.id, error: message });
    throw err;
  }
}
