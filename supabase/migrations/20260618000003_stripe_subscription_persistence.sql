-- Migration: 20260618000003_stripe_subscription_persistence.sql
-- Purpose: Add more Stripe subscription state columns to profiles to fix P0.7.

alter table public.profiles
add column if not exists stripe_subscription_id text,
add column if not exists stripe_price_id text,
add column if not exists subscription_provider_status text,
add column if not exists subscription_current_period_end timestamptz,
add column if not exists subscription_cancel_at_period_end boolean,
add column if not exists billing_updated_at timestamptz;
