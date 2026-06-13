export const maxDuration = 60;
import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { getRagConfig, SUPPORTED_MATERIAL_MIME_TYPES, SUPPORTED_MATERIAL_EXTENSIONS } from '@/lib/rag/config';
import { ingestStudyMaterial, materialContentHash } from '@/lib/rag/ingest';
import { validateMagicBytesArray } from '@/lib/utils/magicBytes';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { EventWorkerService } from '@/lib/events/worker';
import { logger } from '@/lib/utils/logger';
import { featureFlags } from '@/lib/config/flags';
import { ingestLearningSignal } from '@/lib/learning-signals/ingest';
import { betaAccessErrorResponse, requireActiveBetaUser } from '@/lib/access/beta-access';
import { featureDisabledResponse, isFeatureEnabled } from '@/lib/feature-registry';
import { getPlanLimits } from '@/lib/billing/plan-limits';
import { reserveUsage, commitUsage, releaseUsage, FeatureLimitError, featureLimitResponse } from '@/lib/usage/enforce-feature-limit';
import {
  ensureGoalForUser,
  ensureSessionBelongsToUser,
  ensureSessionGoalLink,
} from '@/lib/services/goal-context.service';

const INLINE_INGESTION_MAX_BYTES = 5 * 1024 * 1024;

function sanitizeFilename(value: string): string {
  return value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'material';
}

function formString(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sanitizeSourceType(value: FormDataEntryValue | null): string {
  const sourceType = formString(value) || 'upload';
  // Universal source types — not exam/NEET specific
  const VALID_SOURCE_TYPES = new Set([
    'upload',
    'textbook',    // replaces 'ncert' — any textbook/reference book
    'notes',
    'coaching',
    'pyq',          // previous year questions — valid for any exam
    'solution',
    'reference',    // general reference material
    'article',
    'other',
    // Backward compat: accept 'ncert' but normalize to 'textbook'
    'ncert',
  ]);
  if (!VALID_SOURCE_TYPES.has(sourceType)) return 'other';
  if (sourceType === 'ncert') return 'textbook'; // normalize legacy value
  return sourceType;
}


export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }
    let access;
    try {
      access = await requireActiveBetaUser(user.id);
    } catch (accessError) {
      return betaAccessErrorResponse(accessError, requestId) ?? apiErrorResponse('beta_access_required', {
        status: 403,
        message: 'Cognition OS is currently in a limited beta. Ask the admin to activate your beta access.',
        requestId,
      });
    }
    if (!isFeatureEnabled('rag_upload')) return featureDisabledResponse(requestId);

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'materials-upload',
      maxTokens: 10,
      windowSeconds: 300,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const config = getRagConfig();
    const planLimits = getPlanLimits(access.plan);
    const formData = await req.formData();
    const goalId = formString(formData.get('goalId'));
    const chatSessionId = formString(formData.get('chatSessionId'));
    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);
    if (chatSessionId) {
      const session = await ensureSessionBelongsToUser(supabase, user.id, chatSessionId);
      if (goalId && session.goal_id !== goalId && !session.is_global) {
        await ensureSessionGoalLink(supabase, user.id, chatSessionId, goalId);
      } else if (goalId && session.is_global) {
        return apiErrorResponse('invalid_session', {
          status: 400,
          message: 'Use a goal-linked chat session for goal sources.',
          requestId,
        });
      }
    }
    const file = formData.get('file') as File | null;
    if (!file) {
      logger.warn('Upload rejected: no file provided', { userId: user.id, requestId });
      return apiErrorResponse('invalid_file', { status: 400, message: 'No study material file was provided.', requestId });
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!SUPPORTED_MATERIAL_MIME_TYPES.has(mimeType)) {
      logger.warn('Upload rejected: unsupported file type', { userId: user.id, mimeType, requestId });
      return apiErrorResponse('unsupported_file_type', {
        status: 415,
        message: 'Use PDF, TXT, or Markdown study material.',
        requestId,
      });
    }

    const extensionMatch = file.name ? file.name.match(/\.[^/.]+$/) : null;
    const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '';
    if (!SUPPORTED_MATERIAL_EXTENSIONS.has(extension)) {
      logger.warn('Upload rejected: unsupported file extension', { userId: user.id, extension, requestId });
      return apiErrorResponse('unsupported_file_extension', {
        status: 415,
        message: 'Use files with .pdf, .txt, or .md extensions.',
        requestId,
      });
    }

    const maxFileBytes = Math.min(config.maxFileBytes, planLimits.maxFileMb * 1024 * 1024);
    if (file.size > maxFileBytes) {
      logger.warn('Upload rejected: file too large', { userId: user.id, fileSize: file.size, requestId });
      return apiErrorResponse('file_too_large', {
        status: 413,
        message: `Study material files are capped at ${Math.round(maxFileBytes / 1024 / 1024)}MB for your plan.`,
        requestId,
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytesArray(new Uint8Array(buffer.subarray(0, 12)), mimeType)) {
      logger.warn('Upload rejected: magic byte mismatch', { userId: user.id, mimeType, requestId });
      return apiErrorResponse('invalid_file', { status: 422, message: 'File contents do not match the declared MIME type.', requestId });
    }

    const { count, error: countError } = await supabase
      .from('study_materials')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['uploaded', 'queued', 'processing', 'ready']);
    if (countError) throw countError;
    const maxFiles = Math.min(config.maxFilesPerUser, planLimits.maxMaterials);
    if ((count ?? 0) >= maxFiles) {
      return apiErrorResponse('material_limit_reached', {
        status: 429,
        message: `Your current plan allows ${maxFiles} active study material files.`,
        requestId,
      });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount, error: dailyCountError } = await supabase
      .from('study_materials')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', twentyFourHoursAgo);
      
    if (dailyCountError) throw dailyCountError;
    if ((dailyCount ?? 0) >= config.maxDailyUploads) {
      return apiErrorResponse('daily_upload_limit_reached', {
        status: 429,
        message: `You have reached the daily upload limit of ${config.maxDailyUploads} files.`,
        requestId,
      });
    }

    const contentHash = materialContentHash(buffer);
    const { data: duplicate } = await supabase
      .from('study_materials')
      .select('id, title, status, error_message')
      .eq('user_id', user.id)
      .eq('content_hash', contentHash)
      .maybeSingle();

    if (duplicate) {
      const updates: any = {};
      if (goalId || chatSessionId) {
        updates.goal_id = goalId;
        updates.chat_session_id = chatSessionId;
      }
      if (duplicate.status === 'archived') {
        updates.status = 'uploaded'; // restore from archive
      }
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase
          .from('study_materials')
          .update(updates)
          .eq('id', duplicate.id)
          .eq('user_id', user.id);
      }
      return NextResponse.json({
        material: { ...duplicate, ...updates, goal_id: goalId, chat_session_id: chatSessionId },
        duplicate: true,
      }, { status: 200, headers: { 'x-request-id': requestId } });
    }

    const originalFilename = sanitizeFilename(file.name || 'study-material');
    const title = (formString(formData.get('title')) || originalFilename.replace(/\.[^/.]+$/, '')).slice(0, 160) || originalFilename;
    const storagePath = `${user.id}/${Date.now()}-${contentHash.slice(0, 12)}-${originalFilename}`;

    const upload = await supabase.storage
      .from('study-materials')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });
    if (upload.error) throw upload.error;

    const shouldIngestInline =
      featureFlags.ragIngestion() &&
      buffer.byteLength <= INLINE_INGESTION_MAX_BYTES;
    const initialStatus = !featureFlags.ragIngestion()
      ? 'uploaded'
      : shouldIngestInline
        ? 'processing'
        : 'queued';

    let reservationId: string | null = null;
    try {
      reservationId = await reserveUsage(user.id, 'material_upload', 1, {
        fileSize: file.size,
      });
    } catch (error: any) {
      if (error instanceof FeatureLimitError) return featureLimitResponse(error.check, requestId);
      throw error;
    }

    const { data: material, error: insertError } = await supabase
      .from('study_materials')
      .insert({
        user_id: user.id,
        title,
        original_filename: originalFilename,
        mime_type: mimeType,
        storage_path: storagePath,
        source_type: sanitizeSourceType(formData.get('sourceType')),
        exam_type: formString(formData.get('examType')),
        subject: formString(formData.get('subject')),
        chapter: formString(formData.get('chapter')),
        topic: formString(formData.get('topic')),
        language: formString(formData.get('language')) || 'en',
        status: initialStatus,
        queued_at: featureFlags.ragIngestion() && !shouldIngestInline ? new Date().toISOString() : null,
        retryable: false,
        content_hash: contentHash,
        goal_id: goalId,
        chat_session_id: chatSessionId,
      })
      .select('id, title, status')
      .single();

    if (insertError || !material) {
      if (reservationId) await releaseUsage(reservationId).catch(() => {});
      throw insertError || new Error('Material insert failed');
    }

    if (reservationId) {
      await commitUsage(reservationId, {
        materialId: material.id,
        fileSize: file.size,
        idempotencyKey: `material_upload:${user.id}:${material.id}`,
      }).catch(() => {});
    }

    if (!featureFlags.ragIngestion()) {
      logger.info('Upload accepted without ingestion; RAG disabled', { userId: user.id, materialId: material.id, requestId });
      return NextResponse.json({
        material,
        chunksProcessed: 0,
        duplicate: false,
      }, { status: 202, headers: { 'x-request-id': requestId } });
    }

    if (!shouldIngestInline) {
      const adminClient = await import('@/lib/supabase/admin').then(m => m.createAdminClient());
      const { error: jobError } = await adminClient
        .from('rag_ingestion_jobs')
        .upsert({
          user_id: user.id,
          material_id: material.id,
          status: 'queued',
          idempotency_key: `rag_ingestion:${user.id}:${material.id}`,
          metadata: { mimeType },
        }, { onConflict: 'user_id,material_id,idempotency_key' });

      if (jobError) throw jobError;
    }

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'MATERIAL_UPLOADED',
      data: { materialId: material.id, goalId, chatSessionId },
      metadata: { source: 'materials_upload', goalId, chatSessionId },
      idempotency_key: `material_uploaded:${material.id}`,
    });

    await ingestLearningSignal(supabase, {
      user_id: user.id,
      goal_id: goalId,
      signal_type: 'source_upload',
      source_type: 'study_material',
      source_id: material.id,
      subject: formString(formData.get('subject')),
      topic: formString(formData.get('topic')) ?? formString(formData.get('chapter')),
      confidence: 0.5,
      evidence: {
        title,
        mimeType,
        status: material.status,
      },
    }, {
      publishEvent: true,
      idempotencyKey: `source_upload_signal:${material.id}`,
    }).catch((signalError) => {
      logger.warn('Material learning signal failed', {
        userId: user.id,
        materialId: material.id,
        error: signalError instanceof Error ? signalError.message : String(signalError),
      });
    });


    let ingestionResult: Awaited<ReturnType<typeof ingestStudyMaterial>> | null = null;
    if (shouldIngestInline) {
      ingestionResult = await ingestStudyMaterial({
        materialId: material.id,
        userId: user.id,
        buffer,
        mimeType,
      });
    } else {
      // Fire the worker instantly in the background without blocking the HTTP response.
      after(async () => {
        try {
          logger.info('Instantly triggering background event worker for upload', { userId: user.id, materialId: material.id });
          await EventWorkerService.processBatch(25, 5, 50_000, Date.now());
        } catch (workerError) {
          logger.error('Instant worker trigger failed', { error: workerError });
        }
      });
    }

    const responseStatus = ingestionResult?.status === 'ready'
      ? 'ready'
      : ingestionResult?.status === 'failed'
        ? 'failed'
        : featureFlags.ragIngestion()
          ? 'queued'
          : material.status;

    logger.info('Upload accepted', {
      userId: user.id,
      materialId: material.id,
      mimeType,
      fileSize: file.size,
      status: responseStatus,
      chunksProcessed: ingestionResult?.chunks ?? 0,
      requestId,
    });

    return NextResponse.json({
      material: {
        ...material,
        status: responseStatus,
      },
      chunksProcessed: ingestionResult?.chunks ?? 0,
      duplicate: false,
    }, { status: ingestionResult?.status === 'ready' ? 201 : 202, headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'materials_upload_unhandled', 'Unable to upload study material.');
  }
}
