-- 20260602000500_beta_rls_and_soft_deletes.sql
-- Module 4 (Postgres Setup, RLS, Schema Guardrails)

-- Add deleted_at columns for soft-deletes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deleted_at') THEN
        ALTER TABLE profiles ADD COLUMN deleted_at timestamp with time zone;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_materials' AND column_name = 'deleted_at') THEN
        ALTER TABLE study_materials ADD COLUMN deleted_at timestamp with time zone;
    END IF;
END $$;
-- Enforce strict RLS on profiles and study_materials
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
-- Profile RLS
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id AND deleted_at IS NULL);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = id);
-- Prevent hard deletes by users entirely
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
-- Study Materials RLS
DROP POLICY IF EXISTS "Users can read own study materials" ON study_materials;
CREATE POLICY "Users can read own study materials"
    ON study_materials FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);
DROP POLICY IF EXISTS "Users can insert own study materials" ON study_materials;
CREATE POLICY "Users can insert own study materials"
    ON study_materials FOR INSERT
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own study materials" ON study_materials;
CREATE POLICY "Users can update own study materials"
    ON study_materials FOR UPDATE
    USING (auth.uid() = user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = user_id);
-- Soft delete for study materials instead of hard delete
DROP POLICY IF EXISTS "Users can delete own study materials" ON study_materials;
-- Trigger to prevent manual hard deletions of profiles (Guardrail)
CREATE OR REPLACE FUNCTION prevent_profile_hard_delete()
RETURNS trigger AS $$
BEGIN
    -- Allow hard deletes only if current user is superuser or postgres
    IF current_user IN ('postgres', 'supabase_admin') THEN
        RETURN OLD;
    END IF;
    
    RAISE EXCEPTION 'Hard deletion of profiles is prevented. Use soft delete by setting deleted_at.';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_profile_hard_delete ON profiles;
CREATE TRIGGER trg_prevent_profile_hard_delete
    BEFORE DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_profile_hard_delete();
