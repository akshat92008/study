import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ingestStudyMaterial } from '@/lib/rag/ingest';
import { logger } from '@/lib/utils/logger';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { featureFlags } from '@/lib/config/flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const authError = validateCronRequest(req);
    if (authError) return authError;

    if (!featureFlags.ragIngestion()) {
      return NextResponse.json({ error: 'RAG ingestion is disabled' }, { status: 503 });
    }

    const supabase = createAdminClient();
    const body = await req.json().catch(() => null);
    const materialId = body?.materialId;
    const userId = body?.userId;

    if (!materialId || !userId) {
      return NextResponse.json({ error: 'materialId and userId are required' }, { status: 400 });
    }
    
    // Fetch the material to get storage path and mime type
    const { data: material, error: fetchError } = await supabase
      .from('study_materials')
      .select('storage_path, mime_type')
      .eq('id', materialId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !material) {
      logger.error('Failed to fetch material for ingestion', fetchError);
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Download the buffer from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('study-materials')
      .download(material.storage_path);

    if (downloadError || !fileData) {
      logger.error('Failed to download material buffer', downloadError);
      await supabase
        .from('study_materials')
        .update({ status: 'failed', error_message: 'Failed to read file from storage' })
        .eq('id', materialId)
        .eq('user_id', userId);
      return NextResponse.json({ error: 'File download failed' }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Run ingestion
    await ingestStudyMaterial({
      materialId,
      userId,
      buffer,
      mimeType: material.mime_type
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Background ingestion route failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
