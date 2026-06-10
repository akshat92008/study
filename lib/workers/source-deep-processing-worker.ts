import { createAdminClient } from '@/lib/supabase/admin';
import { runHermesSourceAgent } from '@/lib/hermes/agents/source-agent';
import { logger } from '@/lib/utils/logger';

export class SourceDeepProcessingWorker {
  static async processBatch(limit: number = 10) {
    const supabase = createAdminClient();

    // Find pending materials that have been fully ingested
    const { data: materials, error: fetchError } = await supabase
      .from('study_materials')
      .select('id, user_id, title, goal_id')
      .eq('deep_processing_status', 'pending')
      .eq('status', 'ready')
      .limit(limit);

    if (fetchError) {
      logger.error('Failed to fetch pending deep processing materials', { error: fetchError });
      return;
    }

    if (!materials || materials.length === 0) {
      return;
    }

    for (const material of materials) {
      // Mark as processing
      await supabase
        .from('study_materials')
        .update({ deep_processing_status: 'processing' })
        .eq('id', material.id);

      try {
        // Fetch up to 5 chunks for processing
        const { data: chunks, error: chunksError } = await supabase
          .from('study_material_chunks')
          .select('text')
          .eq('material_id', material.id)
          .order('chunk_index', { ascending: true })
          .limit(5);

        if (chunksError) throw chunksError;
        if (!chunks || chunks.length === 0) {
          throw new Error('No chunks found for deep processing');
        }

        const compactChunks = chunks.map(c => c.text);

        const result = await runHermesSourceAgent({
          userId: material.user_id,
          materialId: material.id,
          title: material.title,
          goalId: material.goal_id,
          compactChunks,
        });

        // Update with the deep processing results (briefingDoc and podcastTranscript)
        await supabase
          .from('study_materials')
          .update({
            briefing_doc: result.briefingDoc || {},
            podcast_transcript: result.podcastTranscript || [],
            deep_processing_status: 'completed',
          })
          .eq('id', material.id);

        logger.info('Completed deep processing for material', { materialId: material.id });
      } catch (error) {
        logger.error('Failed deep processing for material', {
          materialId: material.id,
          error: error instanceof Error ? error.message : String(error),
        });

        await supabase
          .from('study_materials')
          .update({ deep_processing_status: 'failed' })
          .eq('id', material.id);
      }
    }
  }
}
