-- Add seeding_status to profiles so the frontend can poll and show a progress state
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS atlas_seeding_status TEXT DEFAULT 'pending'
    CHECK (atlas_seeding_status IN ('pending', 'seeding', 'complete', 'failed')),
  ADD COLUMN IF NOT EXISTS atlas_seeding_concepts_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atlas_seeding_concepts_done INTEGER DEFAULT 0;
