# Supabase Client Policy

## Client Components

Client components must use browser-safe Supabase clients only. They must not import:

- `createAdminClient`
- `supabaseAdmin`
- `SUPABASE_SERVICE_ROLE_KEY`
- any module that directly exposes the service role client

## Server Routes And Server Components

Server-side authenticated routes should prefer `createClient()` from `lib/supabase/server` so RLS remains part of the safety model.

Use `createAdminClient()` only for:

- Admin routes after `requireAdmin()`
- Internal worker/cron routes after secret validation
- Server services with strict `user_id` scoping and ownership checks
- Database verification and smoke scripts

## Service Role Rules

- Never pass service-role data into client components unless it is already filtered and safe.
- Never mutate rows by a user-provided ID unless the route has first checked ownership or admin authorization.
- Always scope user data queries with `user_id`.
- Prefer upsert/idempotency keys for retryable side effects.
- Log admin actions to `admin_audit_logs` and `admin_audit_log` where available.

## Known Allowed Service-Role Areas

- `lib/events/*` for event queue processing.
- `lib/ai/cost-guard.ts` for atomic budget reservations.
- `lib/access/beta-access.ts` for server-side profile access state.
- `lib/usage/enforce-feature-limit.ts` for feature usage accounting.
- `app/api/admin/*` after `requireAdmin()`.

Any new service-role usage should be documented here during review.
