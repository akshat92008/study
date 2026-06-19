import { createAdminClient } from '@/lib/supabase/admin';
import { ingestStudyMaterial } from '@/lib/rag/ingest';
import { logger } from '@/lib/utils/logger';

/**
 * Background worker to process pending RAG ingestion jobs.
 * This should be triggered by a cron job or asynchronously after an upload.
 */
export async function processPendingIngestionJobs(limit = 5) {
  const supabase = createAdminClient();
  
  // Find pending jobs
  const { data: jobs, error } = await supabase
    .from('rag_ingestion_jobs')
    .select('id, user_id, material_id, attempt_count, metadata')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch pending ingestion jobs', { error });
    return { processed: 0, failed: 0 };
  }

  if (!jobs || jobs.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      // 1. Lock job (atomic update to 'extracting')
      // Note: In Supabase, if we just do an update with an eq('status', 'queued'),
      // it effectively acts as a lock because if another worker got it, status is no longer 'queued'.
      const { data: updatedJob, error: lockError } = await supabase
        .from('rag_ingestion_jobs')
        .update({ status: 'extracting', started_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'queued')
        .select('id')
        .single();
        
      if (lockError || !updatedJob) {
         continue; // somebody else locked it or an error occurred
      }

      logger.info('Processing background RAG ingestion job', { jobId: job.id, materialId: job.material_id });

      // 2. Get Material and storage_path
      const { data: material, error: matError } = await supabase
        .from('study_materials')
        .select('storage_path, mime_type')
        .eq('id', job.material_id)
        .single();
        
      if (matError || !material?.storage_path) {
        throw new Error('Material or storage path not found');
      }

      // 3. Download Buffer from Storage
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('study-materials')
        .download(material.storage_path);
        
      if (downloadError || !fileBlob) {
        throw new Error(`Failed to download material from storage: ${downloadError?.message ?? 'Unknown error'}`);
      }

      const buffer = Buffer.from(await fileBlob.arrayBuffer());

      // 4. Run ingestion
      // We pass the buffer directly to ingestStudyMaterial which handles 
      // extraction, chunking, embedding, and updating the database status.
      const result = await ingestStudyMaterial({
        materialId: job.material_id,
        userId: job.user_id,
        buffer,
        mimeType: material.mime_type,
      });

      if (result.status === 'failed') {
        failed++;
      } else {
        processed++;
      }

    } catch (e) {
      logger.error('Background ingestion job failed', { jobId: job.id, materialId: job.material_id, error: e });
      
      const errorMessage = e instanceof Error ? e.message : String(e);
      
      // Fail job
      await supabase
        .from('rag_ingestion_jobs')
        .update({ 
            status: 'failed', 
            error: errorMessage.slice(0, 500),
            error_code: 'background_processing_error',
            completed_at: new Date().toISOString()
        })
        .eq('id', job.id);
        
      // Mark material as failed
      await supabase
        .from('study_materials')
        .update({
            status: 'failed',
            error_message: errorMessage.slice(0, 500),
            last_error: errorMessage.slice(0, 500),
            last_error_code: 'background_processing_error',
            processing_finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', job.material_id);
      
      failed++;
    }
  }

  return { processed, failed };
}
