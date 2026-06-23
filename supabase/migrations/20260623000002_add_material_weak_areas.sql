ALTER TABLE weak_area_events
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES study_materials(id),
  ADD COLUMN IF NOT EXISTS study_session_id UUID,
  ADD COLUMN IF NOT EXISTS weakness_description TEXT,
  ADD COLUMN IF NOT EXISTS evidence_text TEXT,
  ADD COLUMN IF NOT EXISTS repair_suggestion TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
