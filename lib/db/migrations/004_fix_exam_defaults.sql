-- Migration: Fix exam defaults and add exam date

-- 1. Change the default of exam_type to 'CUSTOM'
ALTER TABLE profiles ALTER COLUMN exam_type SET DEFAULT 'CUSTOM';

-- 2. Add exam_date column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS exam_date TIMESTAMP;
