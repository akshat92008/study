-- Migration: 20260610000002_rag_material_deletion_cascade.sql
-- Purpose: Module 7 — Storage deletion audit column + ensure material deletion
-- marks chunks/embeddings for cleanup when a material is deleted.

-- Add deleted_at soft-delete column to study_materials
ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

-- Add index for soft-delete queries
CREATE INDEX IF NOT EXISTS study_materials_deleted_at_idx
  ON public.study_materials(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- When a material is soft-deleted, mark its chunks as orphaned
-- so the RAG retrieval engine excludes them and a cleanup job can purge.
ALTER TABLE public.study_material_chunks
  ADD COLUMN IF NOT EXISTS orphaned_at timestamptz;

CREATE INDEX IF NOT EXISTS material_chunks_orphaned_idx
  ON public.study_material_chunks(orphaned_at)
  WHERE orphaned_at IS NOT NULL;

-- Function: cascade orphan chunks when material is soft-deleted
CREATE OR REPLACE FUNCTION public.cascade_orphan_chunks_on_material_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.study_material_chunks
    SET orphaned_at = NEW.deleted_at
    WHERE material_id = NEW.id
      AND orphaned_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_orphan_chunks ON public.study_materials;
CREATE TRIGGER trg_cascade_orphan_chunks
  AFTER UPDATE OF deleted_at ON public.study_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_orphan_chunks_on_material_delete();

-- Storage privacy: ensure study_materials has correct user_id ownership
-- (storage bucket policy is managed via Supabase dashboard / Storage policies)
-- This migration documents the requirement for audit purposes.
COMMENT ON TABLE public.study_materials IS
  'User study materials. Storage objects are user-scoped under storage/study-materials/{user_id}/*.
   Deletion must soft-delete this row and orphan chunks. Storage object cleanup is deferred to a cron worker.';
