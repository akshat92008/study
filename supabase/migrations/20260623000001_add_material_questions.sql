CREATE TABLE IF NOT EXISTS material_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  material_id UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB,
  answer TEXT,
  solution TEXT,
  topic TEXT,
  concept TEXT,
  difficulty TEXT DEFAULT 'unknown',
  question_type TEXT DEFAULT 'unknown',
  source_page INTEGER,
  source_chunk_id UUID,
  pattern_fingerprint JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_questions_material ON material_questions(material_id);
CREATE INDEX IF NOT EXISTS idx_material_questions_user ON material_questions(user_id);
