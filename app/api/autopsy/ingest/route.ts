import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMockAutopsy } from '@/lib/engines/autopsy-engine';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const testName = formData.get('testName') as string || 'Mock Test Autopsy';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // In a real production system, for PDFs we might upload to a storage bucket
    // and pass the URL to Gemini via the File API. Since this is an MVP demonstration, 
    // we'll assume we are passing extracted raw text or base64 data to the engine.
    const textData = await file.text();

    const result = await processMockAutopsy(user.id, textData, testName);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Autopsy API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
