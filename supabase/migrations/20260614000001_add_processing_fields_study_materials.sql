-- Add new processing observability fields to study_materials
ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS last_error_code text null,
ADD COLUMN IF NOT EXISTS retry_count int not null default 0,
ADD COLUMN IF NOT EXISTS last_processed_at timestamptz null,
ADD COLUMN IF NOT EXISTS processing_started_at timestamptz null,
ADD COLUMN IF NOT EXISTS processing_finished_at timestamptz null,
ADD COLUMN IF NOT EXISTS chunk_count int not null default 0,
ADD COLUMN IF NOT EXISTS embedding_count int not null default 0,
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz null;
