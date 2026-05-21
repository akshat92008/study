# Cognition OS — Personal Deployment Checklist

## Step 1: Database Migrations (Run in Supabase SQL Editor in order)
- [ ] Run 001_init.sql
- [ ] Run 002_phase2.sql
- [ ] Run 003_autopsy_pulse.sql
- [ ] Run 004_fix_exam_defaults.sql
- [ ] Run 005_production_hardening.sql
- [ ] Run 005_rls_policies.sql
- [ ] Run 006_rate_limiting.sql
- [ ] Run 007_enforce_security.sql
- [ ] Run 008_production_blockers.sql
- [ ] Run 009_vector_search_sql_fix.sql
- [ ] Run 010_god_mode_sql.sql
- [ ] Run 011_global_chat_events.sql
- [ ] Run 012_rls_deploy.sql (NEW — from Module 6)
- [ ] Add unique constraint: ALTER TABLE performance_snapshots ADD CONSTRAINT perf_snap_user_date UNIQUE (user_id, date);

## Step 2: Supabase Configuration
- [ ] Enable pgvector extension: Dashboard → Database → Extensions → vector → Enable
- [ ] Confirm match_concepts RPC function exists (from migration 009 or 010)
- [ ] Enable Realtime on student_events table (if using Supabase Realtime event bus)

## Step 3: Environment Variables (.env.local)
- [ ] NEXT_PUBLIC_SUPABASE_URL=
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY=
- [ ] SUPABASE_SERVICE_ROLE_KEY= (for cron route)
- [ ] GEMINI_API_KEY=
- [ ] CRON_SECRET= (random 32-char string)

## Step 4: Vercel Deployment
- [ ] Push to GitHub
- [ ] Connect repo to Vercel
- [ ] Add all env vars in Vercel dashboard
- [ ] Confirm vercel.json has the cron schedule
- [ ] After deploy, test cron manually: GET /api/cron/daily-synthesis with Authorization: Bearer [CRON_SECRET]

## Step 5: First Session Test
- [ ] Sign up → complete onboarding → upload one PDF → confirm ATLAS has concepts seeded
- [ ] Chat "teach me [topic]" → confirm MIND asks a question back (not just answers directly)
- [ ] Complete a task → confirm streak increments
- [ ] Upload a mock test PDF to autopsy → confirm score bridge appears
- [ ] Navigate to ATLAS → confirm concept nodes visible with mastery colors
- [ ] Navigate to MEMORY → confirm cards exist (generated from upload)
- [ ] Come back after 8 hours → confirm morning briefing appears in chat

## Known Issues to Watch
- If orchestrator_chats is empty on first load, the welcome message seeds correctly — verify in Supabase
- PULSE timing signals are low-confidence (0.4) — this is intentional, single signals don't change state
- expandChapterViaMind runs async — ATLAS may show 1 concept per chapter for 10-30 seconds on first load
- generateMorningBriefing can fail silently — briefing route has catch and returns default string
