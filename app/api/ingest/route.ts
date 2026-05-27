import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocumentIntoMemory } from '@/lib/engines/memory-engine';
import { logger, safeError } from '@/lib/utils/logger';

import pdfParse from 'pdf-parse';

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

    if (mimeType === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;

        if (text.length < 100) {
          return NextResponse.json({
            error: 'PDF appears to be scanned or image-based. Text extraction failed. Please upload a text-based PDF.'
          }, { status: 422 });
        }

        logger.info('PDF parsed successfully', {
          userId: user.id,
          pages: pdfData.numpages,
          textLength: text.length
        });
      } catch (err) {
        return NextResponse.json({
          error: 'Failed to parse PDF. Please ensure the file is not password-protected.'
        }, { status: 422 });
      }
    } else if (mimeType.startsWith('image/')) {
      // GEMINI OCR: Multimodal extraction for photos of notes/OMR sheets
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        logger.info(`Extracting Image via OpenRouter: ${title}`);
        const base64 = buffer.toString('base64');
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp:free',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Extract ALL text content from this image. Preserve headings, lists, and structure. Output strictly the extracted text. Do not add conversational filler.' },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
              ]
            }],
            temperature: 0.1
          })
        });
        
        const data = await response.json();
        text = data.choices?.[0]?.message?.content || '';
      } catch (err) {
        return NextResponse.json({
          error: 'Failed to perform OCR on image.'
        }, { status: 422 });
      }
    } else if (mimeType.startsWith('text/')) {
      text = await file.text();
    } else {
      return NextResponse.json({ error: 'Unsupported file type for knowledge base.' }, { status: 415 });
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
