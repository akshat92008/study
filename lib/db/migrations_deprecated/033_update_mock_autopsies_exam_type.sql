-- Update the default value for exam_type to 'General Study'
ALTER TABLE public.mock_autopsies 
ALTER COLUMN exam_type SET DEFAULT 'General Study';
