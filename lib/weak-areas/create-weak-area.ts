import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export type CreateMaterialWeakAreaInput = {
  userId: string;
  materialId?: string | null;
  studySessionId?: string | null;
  topic?: string | null;
  concept?: string | null;
  weaknessDescription: string;
  evidenceText: string;
  repairSuggestion: string;
  severity?: 'low' | 'medium' | 'high' | 'urgent';
};

export async function createMaterialWeakArea(input: CreateMaterialWeakAreaInput) {
  const supabase = await createClient();
  const {
    userId, materialId, studySessionId, topic, concept,
    weaknessDescription, evidenceText, repairSuggestion, severity = 'medium'
  } = input;

  const { data, error } = await supabase.from('weak_area_events').insert({
    user_id: userId,
    material_id: materialId || null,
    study_session_id: studySessionId || null,
    topic_slug: topic || 'general',
    concept_slug: concept || 'general',
    weakness_description: weaknessDescription,
    evidence_text: evidenceText,
    repair_suggestion: repairSuggestion,
    severity,
    evidence_count: 1,
    status: 'active',
    created_at: new Date().toISOString()
  }).select('id').single();

  if (error) {
    logger.error('Failed to create material weak area', { error: error.message, userId, materialId });
    throw error;
  }

  return data.id;
}
