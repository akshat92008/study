import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { validateMagicBytesArray } from '@/lib/utils/magicBytes';
import { extractSelectableTextFromPdf } from '@/lib/autopsy-v3/extraction/pdf-text-extractor';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';
import { maxPdfBytes } from '@/lib/autopsy-v3/limits';

const BodySchema = z.object({
  assessmentId: z.string().uuid(),
  pdfBase64: z.string().min(1),
  fileName: z.string().max(160).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Extraction payload is invalid.', requestId });
    }

    const buffer = Buffer.from(parsed.data.pdfBase64, 'base64');
    if (buffer.byteLength > maxPdfBytes()) {
      return apiErrorResponse('file_too_large', { status: 413, message: 'PDF exceeds the Deep Autopsy size cap.', requestId });
    }
    if (!validateMagicBytesArray(new Uint8Array(buffer.subarray(0, 12)), 'application/pdf')) {
      return apiErrorResponse('invalid_file', { status: 422, message: 'File contents do not match a PDF.', requestId });
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, metadata')
      .eq('id', parsed.data.assessmentId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (assessmentError) throw assessmentError;
    if (!assessment) return apiErrorResponse('not_found', { status: 404, message: 'Assessment not found.', requestId });

    const extraction = await extractSelectableTextFromPdf(buffer);
    const isPoorExtraction = extraction.confidence < 0.55;
    const extractionStatus = isPoorExtraction ? 'manual_entry_required' : 'ready';
    const needsManualReview = isPoorExtraction;
    
    const warnings = [...extraction.warnings];
    if (isPoorExtraction) {
      warnings.push('The PDF appears to be scanned or contains very little text. OCR is not yet supported. Please manually enter questions.');
    }

    const { error } = await supabase
      .from('assessments')
      .update({
        status: 'answers_pending',
        extraction_status: extractionStatus,
        extraction_confidence: extraction.confidence,
        metadata: {
          ...(assessment.metadata ?? {}),
          fileName: parsed.data.fileName ?? null,
          rawTextPreview: extraction.rawText.slice(0, 20000),
          warnings: warnings,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.assessmentId)
      .eq('user_id', user.id);
    if (error) throw error;

    const fileHash = require('crypto').createHash('sha256').update(buffer).digest('hex');
    const { error: extractionError } = await supabase
      .from('assessment_extractions')
      .insert({
        user_id: user.id,
        file_hash: fileHash,
        raw_text: extraction.rawText,
        metadata: { assessment_id: parsed.data.assessmentId }
      });
    if (extractionError) {
      console.error('Failed to store assessment extraction:', extractionError);
      // Non-fatal, just log it and proceed for now, or maybe throw. We'll throw.
      throw extractionError;
    }

    return jsonWithRequestId({
      extraction: {
        confidence: extraction.confidence,
        warnings: warnings,
        rawTextPreview: extraction.rawText.slice(0, 4000),
        status: extractionStatus,
        needsManualReview: needsManualReview,
      },
    }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_extract', 'Unable to extract selectable text from this PDF.');
  }
}
