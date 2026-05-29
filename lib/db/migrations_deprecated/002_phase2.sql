-- Store uploaded materials (Notes, PDFs text)
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT DEFAULT 'text', -- 'pdf', 'note', 'web'
  raw_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Store vector embeddings for chunks
CREATE TABLE material_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding vector(768), -- Gemini text-embedding-004 dimension
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own materials" ON materials FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own material chunks" ON material_chunks FOR ALL USING (auth.uid() = user_id);

-- Vector Similarity Search Function
CREATE OR REPLACE FUNCTION match_material_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  material_id uuid,
  chunk_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.material_id,
    mc.chunk_text,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM material_chunks mc
  WHERE mc.user_id = p_user_id
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Longitudinal Student Modeling Table
CREATE TABLE student_models (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  learning_style TEXT, -- "Visual, needs analogies"
  strengths TEXT[],
  chronic_weaknesses TEXT[],
  behavioral_traps TEXT[], -- "Panics under time pressure"
  last_updated TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE student_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own model" ON student_models FOR ALL USING (auth.uid() = user_id);

-- Auto-create on profile creation
CREATE OR REPLACE FUNCTION initialize_student_model()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO student_models (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION initialize_student_model();
