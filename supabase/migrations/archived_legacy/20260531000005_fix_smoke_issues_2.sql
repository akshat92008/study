-- Migration: 20260531000005_fix_smoke_issues_2.sql
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS intent TEXT;
