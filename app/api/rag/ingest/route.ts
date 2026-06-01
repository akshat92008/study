import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ingestStudyMaterial } from '@/lib/rag/ingest';
import { logger } from '@/lib/utils/logger';

export const maxDuration = 300; // 5 minutes max duration on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication is required' }, { status: 401 });
    }

    const body = await req.json();
    const { materialId } = body;

    if (!materialId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Fetch the material to get storage path and mime type
    const { data: material, error: fetchError } = await supabase
      .from('study_materials')
      .select('storage_path, mime_type')
      .eq('id', materialId)
      .eq('user_id', user.id)
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
        .eq('user_id', user.id);
      return NextResponse.json({ error: 'File download failed' }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Run ingestion
    await ingestStudyMaterial({
      materialId,
      userId: user.id,
      buffer,
      mimeType: material.mime_type
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Background ingestion route failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
