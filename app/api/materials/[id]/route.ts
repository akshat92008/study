import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });

    const params = await context.params;
    const { data, error } = await supabase
      .from('study_materials')
      .select('id, title, original_filename, mime_type, source_type, exam_type, subject, chapter, topic, language, status, page_count, char_count, error_message, created_at, updated_at, study_material_chunks(id, chunk_index, page_start, page_end, heading, token_estimate)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiErrorResponse('not_found', { status: 404, message: 'Study material was not found.', requestId });

    return NextResponse.json({ material: data }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'material_get_unhandled', 'Unable to load study material.');
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });

    const params = await context.params;
    const { data: material, error: materialError } = await supabase
      .from('study_materials')
      .select('id, storage_path')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (materialError) throw materialError;
    if (!material) return apiErrorResponse('not_found', { status: 404, message: 'Study material was not found.', requestId });

    const { error: deleteError } = await supabase
      .from('study_materials')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', user.id);
    if (deleteError) throw deleteError;

    if (material.storage_path) {
      await supabase.storage.from('study-materials').remove([material.storage_path]).then(() => undefined);
    }

    return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'material_delete_unhandled', 'Unable to delete study material.');
  }
}
