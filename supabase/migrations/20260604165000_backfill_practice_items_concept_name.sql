UPDATE public.practice_items
SET concept_name = topic
WHERE concept_name IS NULL AND topic IS NOT NULL;
