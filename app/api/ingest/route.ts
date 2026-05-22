import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocumentIntoMemory } from '@/lib/engines/memory-engine';
import { GoogleGenAI } from '@google/genai';
import { logger, safeError } from '@/lib/utils/logger';
import { rateLimit } from '@/lib/utils/rate-limit';
import pdfParse from 'pdf-parse';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // --- RATE LIMIT ---
    // 20 requests per 24 hours (86,400,000 ms)
    const isAllowed = await rateLimit(`ingest-${user.id}`, 20, 24 * 60 * 60 * 1000); 
    if (!isAllowed) {
      return NextResponse.json({ error: 'Daily document ingestion limit reached.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const title = file.name;
    const mimeType = file.type || 'application/pdf';
    let text = '';

    // 1. Safely buffer the file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extraction Pipeline
    if (mimeType === 'application/pdf') {
      // PDF PARSE: Fast, token-free local extraction for large files/textbooks
      logger.info(`Extracting PDF locally via pdf-parse: ${title}`);
      const parsed = await pdfParse(buffer);
      text = parsed.text;
      
    } else if (mimeType.startsWith('image/')) {
      // GEMINI OCR: Multimodal extraction for photos of notes/OMR sheets
      logger.info(`Extracting Image via Gemini OCR: ${title}`);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const base64 = buffer.toString('base64');

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: 'Extract ALL text content from this image. Preserve headings, lists, and structure. Output strictly the extracted text. Do not add conversational filler.' },
          ],
        }],
      });
      text = res.text || '';
      
    } else {
      // Standard text/markdown fallback
      text = buffer.toString('utf-8');
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'Could not extract any readable text from this document.' }, { status: 400 });
    }

    // 3. Vectorize and store via pgvector
    const result = await processDocumentIntoMemory(user.id, { title, text });

    // 4. Auto-generate FSRS flashcards in background
    Promise.resolve().then(async () => {
      try {
        const { generateJSON } = await import('@/lib/ai/gemini');
        const { createClient: sc } = await import('@/lib/supabase/server');
        const db = await sc();
        
        // Extract subject and chapter from the material title using AI
        const metaResult = await generateJSON<{ subject: string; chapter: string; conceptCount: number }>('flash',
          'You are a curriculum analyzer.',
          `Given this document title: "${title}", identify the most likely academic subject (e.g. "Physics", "Chemistry", "Biology", "Mathematics") and chapter/topic name it belongs to. Also estimate how many flashcards (3-8) would be appropriate for this material.
          Respond ONLY as JSON: { "subject": string, "chapter": string, "conceptCount": number }`
        );
        
        if (!metaResult?.subject || !metaResult?.chapter) return;
        
        // Find or create a concept node for this material
        const { resolveConceptByName } = await import('@/lib/engines/concept-resolver');
        let conceptId = await resolveConceptByName(user.id, metaResult.subject, metaResult.chapter);
        
        if (!conceptId) {
          const { data: newConcept } = await db.from('concepts').insert({
            user_id: user.id,
            name: metaResult.chapter,
            subject: metaResult.subject,
            chapter: metaResult.chapter,
            topic: 'Uploaded Material',
            mastery: 'exposed',
          }).select().single();
          conceptId = newConcept?.id || null;
        }
        
        if (!conceptId) return;
        
        // Generate flashcards from the material
        const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');
        await generateCardsForConcept(user.id, conceptId, metaResult.subject, metaResult.chapter);
        logger.info(`Background flashcard generation complete for ${title}`);
      } catch (bgErr) {
        logger.warn('Background card generation from upload failed:', bgErr);
      }
    });

    return NextResponse.json({ ...result, text: text.substring(0, 500) + '...' }); // Truncate text in JSON response for bandwidth

  } catch (error: any) {
    logger.error('Document ingestion failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
