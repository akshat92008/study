-- Add missing fields to session_cards for MVP hardening

alter table if exists public.session_cards
  add column if not exists "dayNumber" integer not null default 1,
  add column if not exists "streakDays" integer not null default 0,
  add column if not exists "daysToExam" integer,
  add column if not exists "overdueCards" integer not null default 0,
  add column if not exists "masteryPercent" numeric not null default 0,
  add column if not exists "closingMessage" text,
  add column if not exists "selectionReason" text,
  add column if not exists "mistakeCount" integer not null default 0,
  add column if not exists "weakConceptCount" integer not null default 0,
  add column if not exists "hasActiveGoal" boolean not null default false;
