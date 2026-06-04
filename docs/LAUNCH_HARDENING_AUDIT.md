# Cognition OS Launch Hardening Audit

## REAL / WORKING

- Auth routes exist for signup, login, guest login, and logout.
- Onboarding has a real server-action path and now a real `/api/onboarding/complete` path.
- Dashboard has user-owned API routes, client empty states, and error boundaries around major drawers.
- AI Tutor routes use authenticated sessions, usage gates, rate limits, deterministic/rule-first responses, provider fallback, and budget reservations.
- Study material upload uses auth, file extension/MIME checks, magic-byte validation, size caps, duplicate detection, daily upload caps, queued ingestion, and RLS-backed user ownership.
- RAG retrieval only uses `ready` materials and wraps retrieved text as untrusted source material.
- Event queue has Postgres consumer locks, lease recovery, retry backoff, max attempts, DLQ, stale-route skips, worker health, and internal-secret protection.
- Admin queue/status routes exist and require admin credentials.
- Supabase migrations include RLS coverage, runtime schema alignment, AI usage tracking, source material RAG, autopsy jobs, event queue tables, and goal support.
- Vercel cron is daily, which matches Hobby limits.

## FRAGILE

- Some UI copy still reflects older exam-oriented vocabulary in isolated components.
- RAG ingestion depends on background worker execution; without external cron, sources can remain queued.
- AI quality depends on free-provider availability; this is intentionally cheap but can degrade.
- Admin recovery is API-first and queue-page-first, not a polished full operations console.
- Some schema was assembled through many migrations, so production migration order must be verified before public beta.

## FAKE OR OVERCLAIMED

- Material upload previously returned `queued` while the DB row could remain `uploaded`; this pass stores queued status when ingestion is queued.
- Source panels previously implied all active sources are immediately usable; this pass distinguishes uploaded, queued, processing, failed, and ready.
- `/api/onboarding/complete` previously returned a disabled MVP response; this pass wires it to real onboarding completion.

## BLOCKER

- Split onboarding completion could dead-end API clients.
- Product access had no environment-controlled public beta cap or invite gate.
- External cron calls using `x-internal-worker-secret` could be blocked by middleware before reaching route-level worker auth.
- Dashboard fallback could send onboarded users with no learner data back into onboarding state instead of providing a first mission.

## COST RISK

- Background event bursts can create unnecessary worker load. This pass adds per-user daily event caps and short-window coalescing for noisy event types.
- AI request limits existed, but launch-brief env aliases were not all recognized. This pass adds aliases and a global daily AI request cap.
- Paid fallback remains disabled unless `ENABLE_PAID_AI_FALLBACK=true`.

## SECURITY RISK

- Internal route auth existed, but middleware and route-level worker auth were inconsistent.
- Public waitlist writes need service-role isolation; this pass adds a server-only waitlist route and locked-down table.
- Global error UI showed raw error messages in production; this pass shows a safe generic message in production.

## FIXED IN THIS PASS

- Added canonical onboarding service used by the server action and `/api/onboarding/complete`.
- Added idempotent profile update, active learning goal update/create, and primary goal chat session creation during onboarding.
- Added required custom goal title support to onboarding.
- Added public beta gate with `PUBLIC_BETA_MODE`, `REQUIRE_INVITE_CODE`, `MAX_BETA_USERS`, and `BETA_INVITE_CODES`.
- Added beta waitlist route, page, and migration.
- Added event enqueue pressure guards for daily caps and noisy event coalescing.
- Added external GitHub Actions cron workflow.
- Added material queued persistence, retryable failed status, retry button, and honest source status badges.
- Added explicit source-processing warning for RAG requests before materials are ready.
- Added AI env aliases and global daily AI request cap.
- Made AI provider keys optional at startup so the app can boot with deterministic fallbacks.
- Added baseline security headers, generic production error UI, not-found page, and global loading skeleton.
