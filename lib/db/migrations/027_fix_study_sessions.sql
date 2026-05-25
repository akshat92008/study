-- 1. Auto-create profile when auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    email, 
    onboarding_complete,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student'),
    COALESCE(NEW.email, ''),
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill profiles for any existing auth users missing a profile
INSERT INTO public.profiles (id, full_name, email, onboarding_complete, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Student'),
  COALESCE(au.email, ''),
  false,
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Make study_sessions insert safe — add profile guard at DB level
-- If profile doesn't exist, create it before allowing study_session insert
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, onboarding_complete, created_at, updated_at)
  VALUES (NEW.user_id, 'Student', '', false, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_profile_before_session ON public.study_sessions;
CREATE TRIGGER ensure_profile_before_session
  BEFORE INSERT ON public.study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_exists();
