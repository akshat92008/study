import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocumentIntoMemory } from '@/lib/engines/memory-engine';
import { genai } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 413 });

    const title = file.name.replace(/\.[^/.]+$/, ""); // Strip extension
    const mimeType = file.type || 'application/octet-stream';
    let extractedText = '';

    // If it's a PDF or Image, use Gemini Flash as a Universal OCR Engine
    if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: 'Extract ALL text content from this document. Preserve headings, lists, tables, and structure. Write all mathematical equations in LaTeX format enclosed in $. Output ONLY the extracted markdown text, with absolutely no conversational commentary.' },
          ],
        }],
      });
      
      extractedText = response.text || '';
    } else {
      // Plain text, markdown, etc.
      extractedText = await file.text();
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Could not extract any readable text from the file.' }, { status: 400 });
    }

    // Pass the extracted Markdown to the memory engine for pgvector chunking
    const result = await processDocumentIntoMemory(user.id, { title, text: extractedText });
    
    logger.info('Knowledge Base Ingestion Complete', { userId: user.id, title, chunks: result.chunks });
    return NextResponse.json(result);

  } catch (error: any) {
    logger.error('Ingest API Error', error);
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 });
  }
}
