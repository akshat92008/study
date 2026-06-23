import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudyRoomClient } from '@/components/study-room/StudyRoomClient';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ materialId?: string }> | { materialId?: string };

export default async function StudyRoomPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const initialMaterialId = params?.materialId ?? null;

  const [materialsRes, weakAreasRes] = await Promise.all([
    supabase
      .from('study_materials')
      .select('id, title, original_filename, source_type, status, subject, chapter, topic, chunk_count, page_count, char_count, material_analysis, source_guide, last_processed_at, updated_at, created_at')
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(24),
    supabase
      .from('weak_area_events')
      .select('id, material_id, concept_tag, display_path, weakness_description, evidence_text, recommended_action, repair_suggestion, severity, status, last_seen_at, created_at')
      .eq('user_id', user.id)
      .is('resolved_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(12),
  ]);

  return (
    <StudyRoomClient
      materials={materialsRes.data ?? []}
      weakAreas={weakAreasRes.data ?? []}
      initialMaterialId={initialMaterialId}
    />
  );
}
