-- Migration: 20260618000005_admin_users_and_stripe_constraints.sql
-- Purpose: Create admin_users table and add unique constraints for Stripe IDs to fix P0 blockers.

-- 1. Create admin_users table for explicit admin authorization
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'support')),
  created_at timestamptz default now()
);

-- Enable RLS on admin_users
alter table public.admin_users enable row level security;

-- Admins can read their own row (or others can too depending on need, keeping it strictly to self and service role for now)
create policy "Users can read their own admin role"
  on public.admin_users for select
  to authenticated
  using (auth.uid() = user_id);

-- 2. Add unique constraints to profiles for stripe columns
-- We only add these if they don't already exist, but postgres doesn't easily support "if not exists" for constraints directly without DO blocks.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_stripe_customer_id_key') then
    alter table public.profiles add constraint profiles_stripe_customer_id_key unique (stripe_customer_id);
  end if;
  
  if not exists (select 1 from pg_constraint where conname = 'profiles_stripe_subscription_id_key') then
    alter table public.profiles add constraint profiles_stripe_subscription_id_key unique (stripe_subscription_id);
  end if;
end $$;
