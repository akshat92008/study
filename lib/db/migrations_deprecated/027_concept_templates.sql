-- ============================================================
-- MIGRATION 027: SYLLABUS CONCEPT TEMPLATES CACHE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS concept_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  concepts_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for database security (shared read-only table for public, admin-write)
ALTER TABLE concept_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anonymous users to SELECT templates
CREATE POLICY select_concept_templates ON concept_templates
  FOR SELECT USING (true);

-- Allow service_role / system bypass for administrative inserts
-- (No specific non-admin policies means only service_role/admin can write)

-- Unique constraint index for fast lookup of exam-subject-chapter syllabuses
CREATE UNIQUE INDEX IF NOT EXISTS idx_concept_templates_lookup ON concept_templates (exam_type, subject, chapter);
