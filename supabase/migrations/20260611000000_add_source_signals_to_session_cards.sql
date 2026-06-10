-- Add source_signals column to session_cards if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'session_cards' 
    AND column_name = 'source_signals'
  ) THEN
    ALTER TABLE public.session_cards 
    ADD COLUMN source_signals jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
