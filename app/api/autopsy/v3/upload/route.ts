import { NextRequest } from 'next/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { validateMagicBytesArray } from '@/lib/utils/magicBytes';
import { extractSelectableTextFromPdf } from '@/lib/autopsy-v3/extraction/pdf-text-extractor';
import { enforceDailyTableCap, jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';
import { maxPdfBytes } from '@/lib/autopsy-v3/limits';
import { featureFlags } from '@/lib/config/flags';

function formString(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'assessment.pdf';
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user, limits } = auth;

    if (!featureFlags.autopsyUploads()) {
      return apiErrorResponse('feature_disabled', {
        status: 403,
        message: 'Autopsy uploads are currently disabled for the alpha.',
        requestId,
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return apiErrorResponse('invalid_file', { status: 400, message: 'No PDF was provided.', requestId });
    }

    if ((file.type || 'application/pdf') !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      return apiErrorResponse('unsupported_file_type', {
        status: 415,
        message: 'Deep Autopsy currently supports selectable-text PDFs for upload. Use manual entry for other files.',
        requestId,
      });
    }

    const maxBytes = maxPdfBytes();
    if (file.size > maxBytes) {
      return apiErrorResponse('file_too_large', {
        status: 413,
        message: `Deep Autopsy PDFs are capped at ${limits.maxPdfMb}MB.`,
        requestId,
      });
    }

    const cap = await enforceDailyTableCap({
      supabase,
      userId: user.id,
      table: 'assessments',
      limit: limits.dailyPdfUploadsPerUser,
      requestId,
      message: `You can upload ${limits.dailyPdfUploadsPerUser} Deep Autopsy PDFs per day.`,
      extra: (query) => query.eq('source', 'pdf'),
    });
    if (cap) return cap;

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytesArray(new Uint8Array(buffer.subarray(0, 12)), 'application/pdf')) {
      return apiErrorResponse('invalid_file', {
        status: 422,
        message: 'File contents do not match a PDF.',
        requestId,
      });
    }

    const title = formString(formData.get('title')) || sanitizeFilename(file.name).replace(/\.pdf$/i, '');
    const goalId = formString(formData.get('goalId'));
    const extraction = await extractSelectableTextFromPdf(buffer);
    const extractionStatus = extraction.confidence >= 0.55 ? 'needs_review' : 'manual_entry_required';
    const status = extraction.confidence >= 0.55 ? 'needs_review' : 'answers_pending';

    const { data: assessment, error } = await supabase
      .from('assessments')
      .insert({
        user_id: user.id,
        goal_id: goalId,
        title,
        assessment_type: 'custom',
        source: 'pdf',
        status,
        extraction_status: extractionStatus,
        extraction_confidence: extraction.confidence,
        metadata: {
          originalFilename: sanitizeFilename(file.name),
          fileSize: file.size,
          rawTextPreview: extraction.rawText.slice(0, 20000),
          warnings: extraction.warnings,
          experimentalOcrEnabled: limits.experimentalOcrEnabled,
        },
      })
      .select('*')
      .single();
    if (error) throw error;

    return jsonWithRequestId({
      assessment,
      extraction: {
        confidence: extraction.confidence,
        warnings: extraction.warnings,
        rawTextPreview: extraction.rawText.slice(0, 4000),
        manualEntryRequired: extraction.confidence < 0.55,
      },
      message: extraction.confidence < 0.55
        ? 'We could not reliably read this PDF. You can still continue with manual entry.'
        : 'Selectable text was extracted. Please review it before generating a report.',
    }, requestId, 201);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_upload', 'Unable to upload Deep Autopsy PDF.');
  }
}
