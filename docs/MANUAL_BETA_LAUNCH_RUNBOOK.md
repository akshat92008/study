# Manual Beta Launch Runbook

## Pre-merge Checklist
- [x] All PR tests passing (`npm test`, `npm run typecheck`, etc.)
- [x] Schema migrations created and reviewed
- [x] Admin controls verified and access gated
- [x] Stripe/payment disabled or gated to manual admin override only
- [x] Autopsy workflow is production-safe
- [x] Worker queues correctly report uppercase enums and jobs process correctly
- [x] AI Budget guards (global and monthly) are enforced server-side
- [x] Scripts correctly handle environment fallbacks and failure states

## Required Environment Variables
The following environment variables are strictly required for the manual beta environment:
```env
# Supabase Remote Staging/Production connection
SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...

# Postgres Connection for Schema Check
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Feature & Limit Toggles
NEXT_PUBLIC_BETA_MODE=true
```

## Deployment Sequence

### 1. Supabase Migration Apply Steps
Run migrations against staging or production:
```bash
supabase migration up
```

### 2. Schema Cache Reload Step
Run this in the Supabase SQL editor or via `psql` to refresh the PostgREST cache so that `feature_usage_events` becomes visible immediately:
```sql
NOTIFY pgrst, 'reload schema';
```
*(If that does not refresh PostgREST schema cache, redeploy/restart the Supabase API layer if available, then rerun smoke tests.)*

### 3. Local Verification Commands
```bash
supabase start
npm run launch:manual-beta-local
```

### 4. Remote Verification Commands
Ensure your environment variables are loaded, then:
```bash
npm run launch:manual-beta-remote
```

## Admin Workflows

### Admin Beta Approval Flow
1. User requests access or is invited.
2. Founder uses admin script or `POST /api/admin/users/grant-beta` with `{ "targetUserId": "...", "betaAccessUntil": "..." }`.
3. Plan is set to `'founding'` or custom limited `'pro'`.

### Manual Payment Flow
- Fully automated Stripe payments are disabled.
- Webhook enforces `manual_beta_access_only` and will ignore automated events.
- If upgrading a user to a paid plan manually, set `manual_plan: 'pro'` via admin endpoint.

### First 10-User Onboarding Procedure
1. Verify Supabase migrations applied and `schema:check` passes.
2. Monitor first signup in real-time.
3. Call `grant-beta` API for the user ID.
4. Manually monitor their first Autopsy loop to ensure no orphaned jobs.

### Daily Founder Monitoring Checklist
- [ ] **Queue Pending Count:** Keep under 50.
- [ ] **DLQ Count:** Ensure `event_dlq` is empty or handled daily.
- [ ] **Oldest Pending Event Age:** Look for stuck tasks > 5 mins.
- [ ] **Upload/Autopsy/RAG Failures:** Check `autopsy_jobs` for `failed` or `dead_letter` statuses.
- [ ] **AI Spend Today:** Check `ai_usage_events` vs the daily global budget.
- [ ] **Blocked Users:** Check logs for users hitting limit walls (`usage_limit_exceeded`).
- [ ] **Access State:** Verify nobody spoofed themselves into an active plan.
- [ ] **Top User Errors:** Review `app_error_events` table for critical failures.

## Rollback Plan
If critical systems fail under the 10-user load:
1. Revoke beta access for affected users.
2. Put the site into maintenance mode if there is a data leak or cost runaway.
3. Revert `codex/beta100-hardening` PR.
4. Roll back database state via `supabase migration down` (if required and tested) or manual patch.
5. Notify users via email of the degraded state.

## Known Non-Blockers
- Stripe UI errors during checkout (since checkout is bypassed).
- Non-critical admin UI rendering bugs (as admin uses CLI/API primarily).
- Degraded mode fallback responses for AI when providers are down.

## Hard No-Go Conditions
- Build fails (`npm run build`).
- Schema migration missing or `feature_usage_events` not visible.
- Manual beta smoke test fails (`npm run smoke:manual-beta`).
- Worker cannot drain queue or queue statuses are corrupted.
- Admin approval flow broken.
- Cost guard broken.
- Autopsy upload/report loop broken.
- RLS check fails.
- Users can self-upgrade or spoof plan.
