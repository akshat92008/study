-- Create rate_limits table for Supabase-backed rate limiting
-- Run this SQL in your Supabase SQL editor

create table if not exists public.rate_limits (
  key text primary key,
  tokens integer not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Optional: Add an index on expires_at for cleanup queries
create index if not exists idx_rate_limits_expires_at on public.rate_limits(expires_at);