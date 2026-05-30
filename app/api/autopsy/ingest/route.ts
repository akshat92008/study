import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMockAutopsy } from '@/lib/engines/autopsy-engine';
import { logger, safeError } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import {
  assertDailyAIUsageBudget,
  isAIUsageBudgetExceeded,
  trackDailyAIUsage,
} from '@/lib/services/ai-usage.service';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const POST = withRateLimit('autopsy', async (request, userId) => {
  try {
    const supabase = await createClient();
    const contentType = request.headers.get('content-type') || '';

    let testName = 'Mock Test Autopsy';
    let customScoring: { correctMarks: number; negativeMarks: number } | undefined;
    let fileData: { kind: 'text'; text: string } | { kind: 'inline'; mimeType: string; data: string } | null = null;
    let requestedExamType: string | undefined;
    let fileSizeKB: number | undefined;
    let mimeType = 'text/plain';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      testName = body.testName || body.fileName || testName;
      requestedExamType = body.examType;

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
          return NextResponse.json({ error: 'No base64 upload provided.' }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
          return NextResponse.json(
            { error: 'Unsupported file type. Use PDF, TXT, or image (JPEG/PNG/WebP).' },
            { status: 415 }
          );
        }

        const byteSize = Buffer.byteLength(base64, 'base64');
        fileSizeKB = Math.round(byteSize / 1024);
        if (byteSize > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json(
            { error: `File too large (${Math.round(byteSize / 1024 / 1024)}MB). Maximum is 20MB.` },
            { status: 413 }
          );
        }

        const buffer = Buffer.from(base64, 'base64');
        const { validateMagicBytesArray } = await import('@/lib/utils/magicBytes');
        const isValidBytes = validateMagicBytesArray(new Uint8Array(buffer.subarray(0, 12)), mimeType);
        if (!isValidBytes) {
          return NextResponse.json(
            { error: 'File contents do not match the declared MIME type. Potential malware blocked.' },
            { status: 422 }
          );
        }

        fileData = { kind: 'inline', mimeType, data: base64 };
      }
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      testName = (formData.get('testName') as string) || testName;
      const correctMarksStr = formData.get('correctMarks') as string;
      const negativeMarksStr = formData.get('negativeMarks') as string;

      customScoring =
        correctMarksStr && negativeMarksStr
          ? { correctMarks: Number(correctMarksStr), negativeMarks: Number(negativeMarksStr) }
          : undefined;

      if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is 20MB.` },
          { status: 413 }
        );
      }

      mimeType = file.type || 'application/octet-stream';
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return NextResponse.json(
          { error: 'Unsupported file type. Use PDF, TXT, or image (JPEG/PNG/WebP).' },
          { status: 415 }
        );
      }

      const { validateMagicBytes } = await import('@/lib/utils/magicBytes');
      const isValidBytes = await validateMagicBytes(file, mimeType);
      if (!isValidBytes) {
        return NextResponse.json(
          { error: 'File contents do not match the declared MIME type. Potential malware blocked.' },
          { status: 422 }
        );
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
      return NextResponse.json({ error: 'No upload content provided.' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('exam_type')
      .eq('id', userId)
      .single();

    const examType = requestedExamType || profile?.exam_type || 'General Study';

    logger.info('Starting autopsy', { userId, testName, mimeType, fileSizeKB });

    try {
      await assertDailyAIUsageBudget({
        userId,
        kind: 'autopsy',
        estimatedPromptTokens: fileData.kind === 'text'
          ? Math.ceil(fileData.text.length / 4)
          : Math.ceil(Buffer.byteLength(fileData.data, 'base64') / 4),
        estimatedCompletionTokens: 2500,
      });
    } catch (error) {
      if (isAIUsageBudgetExceeded(error)) {
        return NextResponse.json(
          {
            error: 'Daily AI budget exceeded',
            message: 'AUTOPSY is paused for today before any extraction ran. Try again tomorrow or reduce file size.',
            limitUsd: error.limitUsd,
            usedUsd: error.usedUsd,
          },
          { status: error.status }
        );
      }
      throw error;
    }

    const result = await processMockAutopsy(userId, fileData, testName, examType, customScoring);
    await trackDailyAIUsage({
      userId,
      kind: 'autopsy',
      route: '/api/autopsy/ingest',
      model: fileData.kind === 'text' ? 'router:flash+pro' : 'router:multimodal+pro',
      promptTokens: fileData.kind === 'text' ? Math.ceil(fileData.text.length / 4) : Math.ceil(Buffer.byteLength(fileData.data, 'base64') / 4),
      completionTokens: Math.ceil(JSON.stringify(result).length / 4),
    });
    if (mimeType.startsWith('image/')) {
      await trackDailyAIUsage({ userId, kind: 'image', route: '/api/autopsy/ingest', model: 'router:multimodal' });
    }
    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json(safeError(error), { status: 500 });
  }
});
