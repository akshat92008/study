-- Ensure concept_templates has the cache_key column for global caching
ALTER TABLE concept_templates
  ADD COLUMN IF NOT EXISTS cache_key TEXT,
  ADD COLUMN IF NOT EXISTS exam_type TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS chapter TEXT,
  ADD COLUMN IF NOT EXISTS concepts_json JSONB;

-- Unique index on cache_key for fast global lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_concept_templates_cache_key
  ON concept_templates (cache_key);

-- Index for exam-level queries
CREATE INDEX IF NOT EXISTS idx_concept_templates_exam_subject
  ON concept_templates (exam_type, subject);

-- Ensure concept_templates is accessible without RLS interference
-- (Templates are global/shared, not per-user)
ALTER TABLE concept_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "concept_templates_read_all"
  ON concept_templates FOR SELECT
  USING (true);

CREATE POLICY "concept_templates_insert_service"
  ON concept_templates FOR INSERT
  WITH CHECK (true);
