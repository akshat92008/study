CREATE TABLE IF NOT EXISTS study_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  material_id UUID REFERENCES study_materials(id),
  study_session_id UUID,
  question_id UUID REFERENCES material_questions(id),
  generated_question_text TEXT,
  user_answer TEXT,
  evaluation_status TEXT DEFAULT 'pending',
  score NUMERIC,
  feedback TEXT,
  weak_area_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_attempts_user ON study_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_study_attempts_material ON study_attempts(material_id);
