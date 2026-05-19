import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMockAutopsy } from '@/lib/engines/autopsy-engine';
import { logger, safeError } from '@/lib/utils/logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 
  'text/plain', 
  'text/markdown',
  'image/jpeg', 
  'image/png', 
  'image/webp'
]);

import { rateLimit } from '@/lib/utils/rate-limit';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Limit: 50 requests per 15 minutes per user
    const ip = request.headers.get('x-forwarded-for') || user.id;
    if (!await rateLimit(ip, 50, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait a few minutes.' }, { status: 429 });
    }

    // 1. Parse Multipart Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    let testName = formData.get('testName') as string || 'Mock Test Autopsy';
    const correctMarksStr = formData.get('correctMarks') as string;
    const negativeMarksStr = formData.get('negativeMarks') as string;
    
    const customScoring = correctMarksStr && negativeMarksStr 
      ? { correctMarks: Number(correctMarksStr), negativeMarks: Number(negativeMarksStr) } 
      : undefined;
    
    testName = testName.replace(/\.[^/.]+$/, ""); // Strip extension for clean UI
    
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // 2. Validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit. Please compress.' }, { status: 413 });
    }

    const mimeType = file.type || 'text/plain';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, TXT, or Image.' }, { status: 415 });
    }

    // 3. Buffer File for Gemini
    let fileData: { kind: 'text'; text: string } | { kind: 'inline'; mimeType: string; data: string };

    if (mimeType.startsWith('text/')) {
      fileData = { kind: 'text', text: await file.text() };
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      fileData = { kind: 'inline', mimeType, data: base64 };
    }

    // 4. Fetch Exam Profile
    const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', user.id).single();
    const examType = profile?.exam_type || 'NEET';

    logger.info('Starting Mock Autopsy Processing', { userId: user.id, testName, mimeType });
    
    // 5. Execute Autopsy Engine
    const result = await processMockAutopsy(user.id, fileData, testName, examType, customScoring);

    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
