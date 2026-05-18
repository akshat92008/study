import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocumentIntoMemory } from '@/lib/engines/memory-engine';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const title = file.name;

    const result = await processDocumentIntoMemory(user.id, { title, text });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Ingest API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
