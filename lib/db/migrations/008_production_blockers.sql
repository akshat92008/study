-- 1. Create Vector Search RPC for Material Chunks
CREATE OR REPLACE FUNCTION match_material_chunks(
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
  WHERE 1 - (mc.embedding <=> query_embedding) > match_threshold
    AND mc.user_id = p_user_id
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Add Monetization Fields to Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free';

-- 3. Create Educator Dashboard Tables (Teams)
CREATE TABLE IF NOT EXISTS institutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES profiles(id),
  stripe_subscription_id text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institute_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'student',
  joined_at timestamp DEFAULT now()
);

-- 4. Enable RLS and Policies for Educator Tables
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE institute_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own institutes" ON institutes FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users access own memberships" ON institute_memberships FOR ALL USING (auth.uid() = user_id);
