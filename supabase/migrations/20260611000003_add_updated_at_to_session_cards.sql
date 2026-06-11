ALTER TABLE public.session_cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Drop and recreate the trigger safely if update_updated_at function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
        DROP TRIGGER IF EXISTS session_cards_updated_at ON public.session_cards;
        CREATE TRIGGER session_cards_updated_at
            BEFORE UPDATE ON public.session_cards
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at();
    END IF;
END $$;
