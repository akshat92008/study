-- Drop the study_materials constraints to support custom states and types during beta testing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'study_materials_status_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.study_materials DROP CONSTRAINT study_materials_status_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'study_materials_source_type_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.study_materials DROP CONSTRAINT study_materials_source_type_check;
  END IF;
END $$;
