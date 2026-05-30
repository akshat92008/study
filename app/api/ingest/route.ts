import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocumentIntoMemory } from '@/lib/engines/memory-engine';
import { logger, safeError } from '@/lib/utils/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { validateUploadedFile } from '@/lib/middleware/validateUpload';
import { handleVisionMessage } from '@/lib/ai/provider-client';

import pdfParse from 'pdf-parse';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'ingest',
      maxTokens: 10,      // 10 uploads per 5 minutes
      windowSeconds: 300,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const userId = user.id;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const title = file.name;
    const mimeType = file.type || 'application/pdf';
    // Store original file in Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const validation = validateUploadedFile(fileBuffer, mimeType, file.name);
    if (!validation.valid) return validation.error!;

    const storageFileName = `${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const adminClient = createAdminClient();
    const { data: storageData, error: storageErr } = await adminClient.storage
      .from('user-materials')
      .upload(storageFileName, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });
    const storagePath = storageErr ? null : storageData?.path;
    if (storageErr) {
      logger.warn('File storage failed (non-fatal, continuing with processing)', {
        userId: userId,
        fileName: file.name,
        error: storageErr.message,
      });
    }
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
          userId: userId,
          pages: pdfData.numpages,
          textLength: text.length
        });
      } catch (err) {
        return NextResponse.json({
          error: 'Failed to parse PDF. Please ensure the file is not password-protected.'
        }, { status: 422 });
      }
    } else if (mimeType.startsWith('image/')) {
      // Multimodal extraction for photos of notes/OMR sheets through the provider router.
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        logger.info(`Extracting image text through provider router: ${title}`);
        const base64 = buffer.toString('base64');
        text = await handleVisionMessage(
          base64,
          mimeType,
          'Extract ALL text content from this image. Preserve headings, lists, and structure. Output strictly the extracted text. Do not add conversational filler.',
          'You are an OCR extraction engine for study materials.'
        );
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
    const result = await processDocumentIntoMemory(userId, {
      title,
      text,
      storage_path: storagePath,
      file_size_bytes: fileBuffer.byteLength,
      mime_type: mimeType,
      original_filename: file.name,
    });

    // 4. Auto-generate FSRS flashcards in background
    Promise.resolve().then(async () => {
      try {
        const { generateJSON } = await import('@/lib/ai/provider-client');
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
        let conceptId = await resolveConceptByName(userId, metaResult.subject, metaResult.chapter);
        
        if (!conceptId) {
          const { data: newConcept } = await db.from('concepts').insert({
            user_id: userId,
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
        await generateCardsForConcept(userId, conceptId, metaResult.subject, metaResult.chapter);
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
