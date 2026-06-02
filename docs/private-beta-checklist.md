# Private Beta Launch Checklist

This document is the final sanity check before onboarding the first 10 external users for the private beta.

## 1. Environment & Configuration
- [ ] `ENABLE_AGENT_ACTIONS=false`
- [ ] `ENABLE_AI_ESCALATION=true`
- [ ] `ENABLE_RAG_INGESTION=false` (or heavily monitored)
- [ ] `ENABLE_AUTOPSY_PROCESSING=false` (or heavily monitored)
- [ ] `ENABLE_VISION_UPLOADS=false`
- [ ] `AI_DAILY_BUDGET_CENTS` is set (e.g., `200` for $2/day per user)
- [ ] `AI_MONTHLY_BUDGET_CENTS` is set (e.g., `1000` for $10/month per user)
- [ ] `ADMIN_EMAILS` or `ADMIN_USER_IDS` is configured with authorized users.
- [ ] `INTERNAL_INTERNAL_CRON_SECRET` is set and matches worker schedules.

## 2. Infrastructure & Operations
- [ ] Database migrations are fully applied (no schema drift).
- [ ] RLS policies are enabled on all user-data tables (`profiles`, `study_materials`, `mock_autopsies`, etc.).
- [ ] `npm run build` succeeds locally.
- [ ] The `process-events` worker cron job is running reliably (verified in GitHub Actions or Vercel Cron).

## 3. Product Functionality
- [ ] Sign in works correctly.
- [ ] Generating 1 chat message returns a response (or a graceful fallback if budget/API fails).
- [ ] Uploading a PDF fails gracefully or succeeds depending on `ENABLE_RAG_INGESTION`.
- [ ] Uploading a Mock Test fails gracefully or succeeds depending on `ENABLE_AUTOPSY_PROCESSING`.
- [ ] Admin dashboard (`/admin`) is accessible only to admins.

## 4. Cost Control & Safety
- [ ] A test user exceeding their daily budget receives a polite, non-500 response.
- [ ] AI model calls fail closed if the provider key is invalid.
- [ ] Chat loop cannot infinitely recurse (no un-terminating loops in backend logic).

If all checks pass, the environment is certified safe for beta testers.
