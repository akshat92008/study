-- Add columns for NotebookLM-style features to study_materials
ALTER TABLE public.study_materials 
ADD COLUMN IF NOT EXISTS briefing_doc jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS podcast_transcript jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS audio_overview_url text;

-- Add a status for NotebookLM background processing
ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS deep_processing_status text DEFAULT 'pending' CHECK (deep_processing_status IN ('pending', 'processing', 'completed', 'failed'));
