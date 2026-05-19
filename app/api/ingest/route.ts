import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocumentIntoMemory } from '@/lib/engines/memory-engine';
import { GoogleGenAI } from '@google/genai';
import { logger, safeError } from '@/lib/utils/logger';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const title = file.name;
    const mimeType = file.type || 'application/pdf';
    let text = '';

    // 1. Safely buffer the file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Multimodal PDF/Image parsing via Gemini 2.5 Flash
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const base64 = buffer.toString('base64');

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: 'Extract ALL text content from this document. Preserve headings, lists, and structure. Output strictly the extracted text. Do not add conversational filler.' },
          ],
        }],
      });
      text = res.text || '';
    } else {
      // Standard text/markdown fallback
      text = buffer.toString('utf-8');
    }

    if (!text.trim()) return NextResponse.json({ error: 'Could not extract text' }, { status: 400 });

    // 3. Vectorize and store
    const result = await processDocumentIntoMemory(user.id, { title, text });
    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
