-- 039_materials_storage.sql
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

CREATE INDEX IF NOT EXISTS idx_materials_user_created
  ON materials(user_id, created_at DESC);
