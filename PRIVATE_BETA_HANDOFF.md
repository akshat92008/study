# Cognition OS Private-Beta Handoff

## Current Status
- typecheck: PASS
- lint: PASS (0 errors, 176 warnings)
- tests: PASS (188/188 passed)
- build: PASS (Compiled successfully)
- verify:db: PASS (All Database Smoke Tests Passed!)
- latest migration: 20260601082600_fix_streak_rpc_event_type.sql
- migration count: 54
- PULSE runtime: Excluded / absent
- streak behavior: PASS (Updates correctly to 1)
- autopsy ingest: PASS (Ingested successfully, mistakes linked)
- event worker: PASS (Event enqueued and processed successfully)

## Required Production Env Vars
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_APP_URL

## Optional Env Vars
- GEMINI_API_KEY (Google Gemini AI provider, used for embeddings and generation)
- STRIPE_SECRET_KEY (Stripe Billing)
- STRIPE_WEBHOOK_SECRET (Stripe Webhook integration)
- STRIPE_PRO_PRICE_ID (Stripe Pricing)

## Deployment Steps
- Vercel env setup
- Supabase env setup
- build command (`npm run build`)
- post-deploy verify command (`npm run verify:db`)
- worker/cron setup (Verify Cron API routes are secured by `CRON_SECRET`)

## Manual Smoke Test
- signup/login
- daily card
- chat persistence
- session completion
- streak updates to 1
- event worker processes
- autopsy ingest
- verified mistake
- ATLAS update
- MEMORY card created
- next card adapts

## Known Limitations
- local supabase db reset not proven if still unavailable
- private beta only, 5–10 users
- monitor event_queue and consumer_locks daily
