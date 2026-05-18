import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMockAutopsy } from '@/lib/engines/autopsy-engine';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const testName = formData.get('testName') as string || 'Mock Test Autopsy';
    let examType = (formData.get('examType') as string | null) || '';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!examType) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('exam_type')
        .eq('id', user.id)
        .single();
      examType = profile?.exam_type || 'NEET';
    }

    // Determine how to extract content based on file type
    const mimeType = file.type || 'text/plain';
    let fileData:
      | { kind: 'text'; text: string }
      | { kind: 'inline'; mimeType: string; data: string };

    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      fileData = { kind: 'text', text: await file.text() };
    } else if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      fileData = { kind: 'inline', mimeType, data: base64 };
    } else {
      fileData = { kind: 'text', text: await file.text() };
    }

    const result = await processMockAutopsy(user.id, fileData, testName, examType || 'NEET');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Autopsy API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
