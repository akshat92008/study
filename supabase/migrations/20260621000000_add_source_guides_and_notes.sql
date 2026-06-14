-- Add source_guide column to study_materials to cache generated guides
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS source_guide JSONB;

-- Create saved_notes table
CREATE TABLE IF NOT EXISTS saved_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES learning_goals(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for saved_notes
ALTER TABLE saved_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own notes" ON saved_notes
  FOR ALL USING (auth.uid() = user_id);
