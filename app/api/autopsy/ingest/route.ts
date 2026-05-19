import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMockAutopsy } from '@/lib/engines/autopsy-engine';
import { logger, safeError } from '@/lib/utils/logger';

// Hard limits for production stability
const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6 MB limit for Vercel Hobby/Pro stability
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 
  'text/plain', 
  'text/markdown',
  'image/jpeg', 
  'image/png', 
  'image/webp'
]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    let testName = formData.get('testName') as string || 'Mock Test Autopsy';
    const correctMarksStr = formData.get('correctMarks') as string;
    const negativeMarksStr = formData.get('negativeMarks') as string;
    
    const customScoring = correctMarksStr && negativeMarksStr 
      ? { correctMarks: Number(correctMarksStr), negativeMarks: Number(negativeMarksStr) } 
      : undefined;
    
    // Fallback: Strip extensions from filename for cleaner UI display
    testName = testName.replace(/\.[^/.]+$/, "");
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Upload Validation: Size
    if (file.size > MAX_FILE_SIZE) {
      logger.warn('Upload rejected: File too large', { userId: user.id, size: file.size });
      return NextResponse.json({ error: 'File size exceeds 6MB limit. Please compress your PDF or image.' }, { status: 413 });
    }

    // 2. Upload Validation: MIME Type
    const mimeType = file.type || 'text/plain';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      logger.warn('Upload rejected: Invalid MIME', { userId: user.id, type: mimeType });
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF, TXT, or Image.' }, { status: 415 });
    }

    // 3. Buffer Safely
    let fileData: { kind: 'text'; text: string } | { kind: 'inline'; mimeType: string; data: string };

    if (mimeType.startsWith('text/')) {
      fileData = { kind: 'text', text: await file.text() };
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      fileData = { kind: 'inline', mimeType, data: base64 };
    }

    // 4. Fetch User's Exam Type Context
    const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', user.id).single();
    const examType = profile?.exam_type || 'NEET';

    // 5. Process
    logger.info('Starting Mock Autopsy Processing', { userId: user.id, testName, mimeType });
    
    const result = await processMockAutopsy(user.id, fileData, testName, examType, customScoring);

    return NextResponse.json(result);

  } catch (error: any) {
    const safeResponse = safeError(error);
    return NextResponse.json(safeResponse, { status: 500 });
  }
}
