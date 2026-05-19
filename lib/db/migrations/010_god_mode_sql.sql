-- 1. Enable AI Vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Force RLS on all tables (Security)
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

-- 3. Create Vector Search Functions (Required for RAG & Autopsy)
CREATE OR REPLACE FUNCTION match_concepts(
  query_embedding vector(768), match_threshold float, match_count int, p_user_id uuid
) RETURNS TABLE (id uuid, similarity float) LANGUAGE sql STABLE AS $$
  SELECT id, 1 - (embedding <=> query_embedding) AS similarity
  FROM concepts WHERE user_id = p_user_id AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_material_chunks(
  query_embedding vector(768), match_threshold float, match_count int, p_user_id uuid
) RETURNS TABLE (id uuid, chunk_text text, similarity float) LANGUAGE sql STABLE AS $$
  SELECT id, chunk_text, 1 - (embedding <=> query_embedding) AS similarity
  FROM material_chunks WHERE user_id = p_user_id AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding LIMIT match_count;
$$;

-- 4. Dummy Rate Limiter (Prevents your API from crashing, always allows you)
CREATE OR REPLACE FUNCTION check_rate_limit(p_ip text, p_limit int, p_window_seconds int)
RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RETURN true; END; $$;
