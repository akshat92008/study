import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KnowledgeBaseUI from '@/components/knowledge/KnowledgeBaseUI';

export default async function MaterialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: initialMaterials } = await supabase
    .from('study_materials')
    .select('id, title, original_filename, mime_type, source_type, goal_id, chat_session_id, exam_type, subject, chapter, topic, language, status, page_count, char_count, error_message, last_error, last_error_code, next_retry_at, retryable, retry_count, chunk_count, embedding_count, material_analysis, source_guide, last_processed_at, processing_started_at, processing_finished_at, detected_subject, detected_chapter, goal_match_score, mismatch_warning_acknowledged, created_at, updated_at')
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-4 py-8 md:px-8 custom-scrollbar">
      <KnowledgeBaseUI initialMaterials={initialMaterials || []} />
    </div>
  );
}
