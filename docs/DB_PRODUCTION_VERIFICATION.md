# Database Production Verification Checklist

This document outlines the required steps to verify the database layer before and during production deployment of the Cognition OS MVP.

## 1. Local Environment Reset (Pre-Deployment)
Always ensure migrations apply cleanly from zero in a local environment:
```bash
npx supabase db reset --local
npm run verify:db
```
*If `verify:db` passes, it proves the schema, RPC signatures, RLS policies, and critical database triggers are consistent with the runtime codebase.*

## 2. Staging Migration
Test the migration on a staging project before production:
```bash
npx supabase db push --linked
```
*(Assumes `supabase link --project-ref <staging-ref>` has been run).*

## 3. Production Migration Command
Once staging is verified, apply to production:
```bash
npx supabase link --project-ref <production-ref>
npx supabase db push
```

## 4. Required Environment Variables
The following variables must be correctly configured in the production environment (e.g. Vercel):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Required for worker processes and secured RPC calls)

## 5. Required Supabase Extensions
Ensure the following extensions are enabled on the production database:
- `uuid-ossp`
- `vector` (for `ivfflat` or `hnsw` indexes)

## 6. RLS Verification Steps
- Validate that `public.profiles` has policies allowing users to read/update *only* their own rows.
- Ensure that `public.event_queue`, `consumer_locks`, and related worker tables are NOT exposed to the `anon` or `authenticated` roles directly, unless via secured service-role RPCs.
- Run `npm run verify:db` locally or against staging (with appropriate keys) to test that authenticated operations succeed and restricted operations fail natively.

## 7. Smoke Test
After deploying migrations, run the MVP smoke test:
```bash
npm run smoke:mvp
```
*Verify that user creation, AI budget allocation, session completion, and mock autopsy ingestion flow works smoothly.*

## 8. Rollback Guidance
If a migration fails in production:
1. Identify the failing statement in the Supabase dashboard.
2. DO NOT delete critical data tables (e.g., `profiles`, `concepts`).
3. If necessary, write a safe `down` migration or a forward-fix migration to resolve the inconsistency.
4. Redeploy the fix using `npx supabase db push`.

## 9. Known Limitations
- Background worker events (`create_event_with_consumers`) are restricted to `service_role`. Clients must trigger workflows via their respective high-level RPCs or edge functions.
- The default `anon` key is highly restricted and depends extensively on `auth.uid()` checks in RLS and security definer functions.

## 10. Launch Blockers
Before public launch, the following MUST pass:
- [x] Local `supabase db reset` must be 100% clean without errors.
- [x] `npm run verify:db` must pass all tests.
- [x] Application tests (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`) must pass cleanly.
