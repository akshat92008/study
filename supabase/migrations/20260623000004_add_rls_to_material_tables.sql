-- Enable RLS
ALTER TABLE material_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for material_questions
CREATE POLICY "Users can view their own material questions"
  ON material_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own material questions"
  ON material_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own material questions"
  ON material_questions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own material questions"
  ON material_questions FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for study_attempts
CREATE POLICY "Users can view their own study attempts"
  ON study_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own study attempts"
  ON study_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study attempts"
  ON study_attempts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study attempts"
  ON study_attempts FOR DELETE
  USING (auth.uid() = user_id);

-- Grant privileges to authenticated users and service role
GRANT SELECT, INSERT, UPDATE, DELETE ON material_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON material_questions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON study_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON study_attempts TO service_role;
