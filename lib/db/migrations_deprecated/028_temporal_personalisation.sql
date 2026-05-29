-- Add peak_productivity_hour to student_models for temporal personalisation
ALTER TABLE student_models 
ADD COLUMN peak_productivity_hour integer DEFAULT 10;
