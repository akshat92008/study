// app/api/documents/export-pdf/route.ts
// POST endpoint that generates an OCR-friendly PDF from a GeneratedDocument.
// Requires authentication. Rate-limited to 5 exports/minute per user.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { apiErrorResponse, unexpectedApiErrorResponse, getRequestId } from '@/lib/api/errors';
import { renderDocumentPDF, getPDFFilename } from '@/lib/documents/render-document-pdf';
import type { GeneratedDocument } from '@/lib/documents/document-types';

const MAX_BODY_BYTES = 100 * 1024; // 100 KB

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(req);

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return apiErrorResponse('unauthorized', {
      status: 401,
      message: 'Authentication is required to export documents.',
      requestId,
    });
  }

  // ── Rate limit: 5 PDF exports per minute per user ───────────────────────────
  const rateResult = await checkRateLimit({
    identifier: user.id,
    bucket: 'doc_export',
    maxTokens: 5,
    windowSeconds: 60,
  });

  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many PDF exports. Please wait a moment.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(rateResult.remaining),
          'X-RateLimit-Reset': String(rateResult.resetAt),
        },
      }
    );
  }

  // ── Input validation ────────────────────────────────────────────────────────
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return apiErrorResponse('payload_too_large', {
      status: 413,
      message: 'Document payload exceeds 100 KB limit.',
      requestId,
    });
  }

  let body: { document?: GeneratedDocument };
  try {
    body = await req.json();
  } catch {
    return apiErrorResponse('invalid_json', {
      status: 400,
      message: 'Request body must be valid JSON.',
      requestId,
    });
  }

  if (!body.document || typeof body.document !== 'object') {
    return apiErrorResponse('missing_document', {
      status: 400,
      message: 'Request body must include a "document" field.',
      requestId,
    });
  }

  const doc = body.document;

  // Validate document has a kind
  const validKinds = ['mock_test', 'formula_sheet', 'mcq_flashcards', 'learning_notes'];
  if (!validKinds.includes(doc.kind as string)) {
    return apiErrorResponse('invalid_document_kind', {
      status: 400,
      message: `Invalid document kind. Must be one of: ${validKinds.join(', ')}.`,
      requestId,
    });
  }

  // ── PDF generation ──────────────────────────────────────────────────────────
  try {
    const pdfBuffer = renderDocumentPDF(doc);
    const filename = getPDFFilename(doc);

    // Use native Response (not NextResponse) to correctly handle binary ArrayBuffer body
    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
    }) as unknown as NextResponse;
  } catch (err) {
    return unexpectedApiErrorResponse(req, err, 'export-pdf', 'Failed to generate PDF. Please try again.');
  }
}
