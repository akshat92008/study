import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMockAutopsy } from '@/lib/engines/autopsy-engine';
import { logger, safeError } from '@/lib/utils/logger';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    let testName = (formData.get('testName') as string) || 'Mock Test Autopsy';
    const correctMarksStr  = formData.get('correctMarks') as string;
    const negativeMarksStr = formData.get('negativeMarks') as string;

    const customScoring =
      correctMarksStr && negativeMarksStr
        ? { correctMarks: Number(correctMarksStr), negativeMarks: Number(negativeMarksStr) }
        : undefined;

    testName = testName.replace(/\.[^/.]+$/, '');

    if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is 20MB.` },
        { status: 413 }
      );
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, TXT, or image (JPEG/PNG/WebP).' },
        { status: 415 }
      );
    }

    let fileData: { kind: 'text'; text: string } | { kind: 'inline'; mimeType: string; data: string };

    if (mimeType.startsWith('text/')) {
      fileData = { kind: 'text', text: await file.text() };
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      fileData = { kind: 'inline', mimeType, data: base64 };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('exam_type')
      .eq('id', user.id)
      .single();

    const examType = profile?.exam_type || 'General Study';

    logger.info('Starting autopsy', { userId: user.id, testName, mimeType, fileSizeKB: Math.round(file.size / 1024) });

    const result = await processMockAutopsy(user.id, fileData, testName, examType, customScoring);
    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
