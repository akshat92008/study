-- 1. Create the Vector Search RPC function needed for the Concept Resolver
CREATE OR REPLACE FUNCTION match_concepts(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM concepts c
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    AND c.user_id = p_user_id
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Force Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;

-- 3. Apply Strict Auth Policies (Users can ONLY Select/Insert/Update/Delete their own data)
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('profiles', 'concepts', 'concept_links', 'mistakes', 'revision_cards', 'review_logs', 'study_tasks', 'mock_tests', 'performance_snapshots', 'mentor_chats', 'tutor_sessions', 'study_sessions', 'materials', 'material_chunks')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Users access own %I" ON %I;', t_name, t_name);
        IF t_name = 'profiles' THEN
            EXECUTE format('CREATE POLICY "Users access own %I" ON %I FOR ALL USING (auth.uid() = id);', t_name, t_name);
        ELSE
            EXECUTE format('CREATE POLICY "Users access own %I" ON %I FOR ALL USING (auth.uid() = user_id);', t_name, t_name);
        END IF;
    END LOOP;
END $$;
