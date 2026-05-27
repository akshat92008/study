import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

export async function GET(
  _req: NextRequest,
  { params }: { params: { materialId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership and fetch material metadata
  const { data: material, error: matErr } = await supabase
    .from('materials')
    .select('id, title, storage_path, mime_type, original_filename, created_at')
    .eq('id', params.materialId)
    .eq('user_id', user.id)
    .single();

  if (matErr || !material) {
    return NextResponse.json({ error: 'Material not found' }, { status: 404 });
  }

  if (!material.storage_path) {
    return NextResponse.json({ error: 'File not stored (processed in-memory only)' }, { status: 404 });
  }

  const adminClient = createAdminClient();
  const { data: signedUrl, error: urlErr } = await adminClient.storage
    .from('user-materials')
    .createSignedUrl(material.storage_path, 3600); // 1‑hour URL

  if (urlErr || !signedUrl) {
    logger.error('Failed to create signed URL', { error: urlErr });
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 });
  }

  return NextResponse.json({
    material,
    downloadUrl: signedUrl.signedUrl,
    expiresIn: 3600,
  });
}
