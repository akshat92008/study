import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ingestStudyMaterial } from '@/lib/rag/ingest';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });

    const params = await context.params;
    const { data: material, error } = await supabase
      .from('study_materials')
      .select('id, user_id, mime_type, storage_path')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!material?.storage_path) {
      return apiErrorResponse('not_found', { status: 404, message: 'Study material file was not found.', requestId });
    }

    const download = await supabase.storage.from('study-materials').download(material.storage_path);
    if (download.error || !download.data) throw download.error || new Error('Storage download failed');

    const buffer = Buffer.from(await download.data.arrayBuffer());
    const result = await ingestStudyMaterial({
      materialId: material.id,
      userId: user.id,
      buffer,
      mimeType: material.mime_type,
    });

    return NextResponse.json({ status: result.status, chunksProcessed: result.chunks }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'material_reprocess_unhandled', 'Unable to reprocess study material.');
  }
}
