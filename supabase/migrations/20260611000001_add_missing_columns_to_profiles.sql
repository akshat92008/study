-- Add all missing columns to profiles table
DO $$
BEGIN
  -- Drop any existing manual_plan constraint
  BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_manual_plan_check;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  -- Add onboarding_completed and onboarding_completed_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN onboarding_completed_at timestamptz;
  END IF;

  -- Add beta_access and beta_access_until
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'beta_access'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN beta_access boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'beta_access_until'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN beta_access_until timestamptz;
  END IF;

  -- Add suspended and suspended_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'suspended'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN suspended boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'suspended_reason'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN suspended_reason text;
  END IF;

  -- Add manual_plan
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'manual_plan'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN manual_plan text NOT NULL DEFAULT 'free'
    CHECK (manual_plan IN ('free', 'founding', 'pro', 'admin', 'unlimited'));
  ELSE
    -- If column already exists, update the default and check constraint
    ALTER TABLE public.profiles 
    ALTER COLUMN manual_plan SET DEFAULT 'free';
    
    -- Ensure the check constraint exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'profiles' 
      AND constraint_name = 'profiles_manual_plan_check'
    ) THEN
      ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_manual_plan_check 
      CHECK (manual_plan IN ('free', 'founding', 'pro', 'admin', 'unlimited'));
    END IF;
  END IF;

  -- Add learner_state_version
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'learner_state_version'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN learner_state_version integer NOT NULL DEFAULT 0;
  END IF;

  -- Add subscription_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN subscription_status text NOT NULL DEFAULT 'free';
  END IF;

  -- Add timezone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN timezone text;
  END IF;
END $$;
