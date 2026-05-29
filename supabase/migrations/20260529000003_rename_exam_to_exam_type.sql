DO $$
BEGIN
  -- If 'exam' column exists, rename it to 'exam_type'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'exam' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN exam TO exam_type;
  END IF;

  -- Always attempt to clean up the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_exam_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_exam_check;
  END IF;

  -- Add the new constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_exam_type_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_exam_type_check
      CHECK (exam_type IN ('neet', 'jee', 'jee-advanced', 'other'));
  END IF;
END $$;
