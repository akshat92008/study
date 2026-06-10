-- Drop the exam_type check constraint from profiles to allow custom categories from the new onboarding flow
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_exam_type_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_exam_type_check;
  END IF;
END $$;
