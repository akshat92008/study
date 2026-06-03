import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;
import {
  AutopsyExtractionError,
  AutopsyNeedsUserInputError,
} from '@/lib/engines/autopsy-engine';
import { createAutopsyJob } from '@/lib/services/autopsy-jobs';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import {
  ensureGoalForUser,
  ensureSessionBelongsToUser,
  ensureSessionGoalLink,
} from '@/lib/services/goal-context.service';

import {
  consumeUsageLimit,
  usageGateResponse,
  validatePromptLength,
  validateUploadBytes,
} from '@/lib/utils/billing';

import { featureFlags } from '@/lib/config/flags';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const POST = withRateLimit('autopsy', async (request, userId) => {
  const requestId = getRequestId(request);
  const apiError = (error: string, message: string, status: number, details?: unknown) =>
    apiErrorResponse(error, { message, status, details, requestId, feature: 'autopsy' });

  try {
    const supabase = await createClient();
    const contentType = request.headers.get('content-type') || '';

    let testName = 'Mock Test Autopsy';
    let customScoring: { correctMarks: number; negativeMarks: number } | undefined;
    let fileData: { kind: 'text'; text: string } | { kind: 'inline'; mimeType: string; data: string } | null = null;
    let requestedExamType: string | undefined;
    let fileSizeKB: number | undefined;
    let mimeType = 'text/plain';
    let idempotencyKey = request.headers.get('Idempotency-Key');
    let asyncRequested = true; // Forced true for beta
    let goalId: string | null = null;
    let chatSessionId: string | null = null;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      testName = body.testName || body.fileName || testName;
      requestedExamType = body.examType;
      goalId = typeof body.goalId === 'string' && body.goalId.trim() ? body.goalId.trim() : null;
      chatSessionId = typeof body.chatSessionId === 'string' && body.chatSessionId.trim() ? body.chatSessionId.trim() : null;
      asyncRequested = asyncRequested || body.async === true || body.processAsync === true;
      if (!idempotencyKey && typeof body.idempotencyKey === 'string') {
        idempotencyKey = body.idempotencyKey;
      }

      if (body.correctMarks !== undefined && body.negativeMarks !== undefined) {
        customScoring = {
          correctMarks: Number(body.correctMarks),
          negativeMarks: Number(body.negativeMarks),
        };
      }

      if (body.fileData?.kind === 'text' && typeof body.fileData.text === 'string') {
        fileData = { kind: 'text', text: body.fileData.text };
      } else if (typeof body.rawText === 'string' || typeof body.text === 'string') {
        fileData = { kind: 'text', text: body.rawText || body.text };
      } else {
        const base64 = body.fileData?.data || body.imageBase64 || body.documentBase64 || body.fileBase64 || body.base64;
        mimeType = body.fileData?.mimeType || body.imageMimeType || body.documentMimeType || body.mimeType || 'application/octet-stream';

        if (!base64 || typeof base64 !== 'string') {
          return apiError('invalid_file', 'No base64 upload content was provided.', 400);
        }

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
          return apiError('unsupported_file_type', 'Use PDF, TXT, Markdown, or image (JPEG/PNG/WebP).', 415);
        }

        const byteSize = Buffer.byteLength(base64, 'base64');
        fileSizeKB = Math.round(byteSize / 1024);
        const uploadSize = validateUploadBytes(byteSize);
        if (!uploadSize.allowed) return usageGateResponse(uploadSize);

        const buffer = Buffer.from(base64, 'base64');
        const { validateMagicBytesArray } = await import('@/lib/utils/magicBytes');
        const isValidBytes = validateMagicBytesArray(new Uint8Array(buffer.subarray(0, 12)), mimeType);
        if (!isValidBytes) {
          return apiError('invalid_file', 'File contents do not match the declared MIME type.', 422);
        }

        fileData = { kind: 'inline', mimeType, data: base64 };
      }
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      testName = (formData.get('testName') as string) || testName;
      const formGoalId = formData.get('goalId');
      const formChatSessionId = formData.get('chatSessionId');
      goalId = typeof formGoalId === 'string' && formGoalId.trim() ? formGoalId.trim() : null;
      chatSessionId = typeof formChatSessionId === 'string' && formChatSessionId.trim() ? formChatSessionId.trim() : null;
      idempotencyKey = idempotencyKey || (formData.get('idempotencyKey') as string | null);
      asyncRequested = asyncRequested || formData.get('async') === 'true';
      const correctMarksStr = formData.get('correctMarks') as string;
      const negativeMarksStr = formData.get('negativeMarks') as string;

      customScoring =
        correctMarksStr && negativeMarksStr
          ? { correctMarks: Number(correctMarksStr), negativeMarks: Number(negativeMarksStr) }
          : undefined;

      if (!file) return apiError('invalid_file', 'No file was provided.', 400);

      const uploadSize = validateUploadBytes(file.size);
      if (!uploadSize.allowed) return usageGateResponse(uploadSize);

      mimeType = file.type || 'application/octet-stream';
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return apiError('unsupported_file_type', 'Use PDF, TXT, Markdown, or image (JPEG/PNG/WebP).', 415);
      }

      const { validateMagicBytes } = await import('@/lib/utils/magicBytes');
      const isValidBytes = await validateMagicBytes(file, mimeType);
      if (!isValidBytes) {
        return apiError('invalid_file', 'File contents do not match the declared MIME type.', 422);
      }

      fileSizeKB = Math.round(file.size / 1024);
      if (mimeType.startsWith('text/')) {
        fileData = { kind: 'text', text: await file.text() };
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        fileData = { kind: 'inline', mimeType, data: base64 };
      }
    }

    testName = testName.replace(/\.[^/.]+$/, '');

    if (!fileData) {
      return apiError('invalid_file', 'No upload content was provided.', 400);
    }

    if (goalId) await ensureGoalForUser(supabase, userId, goalId);
    if (chatSessionId) {
      const session = await ensureSessionBelongsToUser(supabase, userId, chatSessionId);
      if (goalId && session.goal_id !== goalId && !session.is_global) {
        await ensureSessionGoalLink(supabase, userId, chatSessionId, goalId);
      } else if (goalId && session.is_global) {
        return apiError('invalid_session', 'Use a goal-linked chat session for Mistake Review uploads.', 400);
      }
    }

    if (fileData.kind === 'text') {
      const promptLength = validatePromptLength(fileData.text);
      if (!promptLength.allowed) return usageGateResponse(promptLength);
    }

    const autopsyUsageGate = await consumeUsageLimit(userId, 'autopsy_uploads_daily');
    if (!autopsyUsageGate.allowed) return usageGateResponse(autopsyUsageGate);

    const { data: profile } = await supabase
      .from('profiles')
      .select('exam_type')
      .eq('id', userId)
      .single();

    const examType = requestedExamType || profile?.exam_type || 'General Study';

    logger.info('Starting autopsy', { userId, requestId, feature: 'autopsy', testName, mimeType, fileSizeKB });

    if (!featureFlags.autopsyProcessing()) {
      return apiErrorResponse('autopsy_disabled', {
        status: 503,
        message: 'Mistake Review is temporarily disabled for beta stability.',
        requestId,
        feature: 'autopsy',
      });
    }

    const job = await createAutopsyJob({
      userId,
      fileData,
      testName,
      examType,
      customScoring,
      goalId,
      chatSessionId,
      idempotencyKey,
      source: 'autopsy_ingest',
      client: supabase,
    });


    return NextResponse.json(
      {
        status: job.status,
        jobId: job.id,
        autopsyId: job.result_autopsy_id,
        error: job.error_message,
      },
      { status: job.status === 'completed' ? 200 : 202 }
    );

  } catch (error: any) {
    if (error instanceof AutopsyNeedsUserInputError || error?.needsUserInput === true) {
      logger.warn('Autopsy needs user input', {
        userId,
        requestId,
        message: error.message,
      });
      return apiError(
        'needs_user_input',
        error.message,
        422,
        {
          needs_user_input: true,
          learner_state_mutated: false,
        }
      );
    }

    // AutopsyExtractionError: the file couldn't be parsed/extracted.
    // Return 422 with a clear user-facing message. Critically: no learner-state
    // mutations can have occurred because the error is thrown before the RPC call.
    if (error instanceof AutopsyExtractionError || error?.extractionFailed === true) {
      const safeExtractionMessage = /api[_ -]?key|provider|model|gemini|openai|anthropic|vertex|stack|trace/i.test(error.message)
        ? 'Mistake Review could not extract enough evidence from this file. Please upload a clearer file with answer key and student answers.'
        : error.message;
      logger.warn('Autopsy extraction failed (user-safe)', {
        userId,
        requestId,
        message: error.message,
      });
      return apiError(
        'extraction_failed',
        safeExtractionMessage,
        422,
        {
          extraction_failed: true,
          learner_state_mutated: false,
        }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    const isPersistenceFailure = message.startsWith('Failed to save autopsy:');
    logger.error('Autopsy ingest internal error', error, { userId, requestId, feature: 'autopsy' });
    return apiError(
      isPersistenceFailure ? 'persistence_failed' : 'internal_error',
      isPersistenceFailure
        ? 'Mistake Review extraction completed but persistence failed. No downstream learner update was trusted.'
        : 'Mistake Review failed unexpectedly.',
      500,
      {
        extraction_failed: false,
        learner_state_mutated: false,
      }
    );
  }
});
