# 100-User Controlled Beta Runbook

## Pre-Launch Checklist

- Apply all Supabase migrations through `supabase db push`.
- Set the beta env variables from `.env.example`.
- Confirm `PAID_BETA_GATE_ENABLED=true` and `MANUAL_BETA_ACCESS_ONLY=true`.
- Confirm `WORKER_AI_ENABLED=false`.
- Confirm `/api/ping` returns `{ "ok": true }`.
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Run `npm run schema:rls:beta` and `npm run smoke:manual-beta`.

## Required Env Groups

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Worker auth: `INTERNAL_CRON_SECRET`, `INTERNAL_WORKER_SECRET` or `WORKER_SECRET`.
- Manual beta: `PAID_BETA_GATE_ENABLED`, `MANUAL_BETA_ACCESS_ONLY`, `ADMIN_EMAILS`, `ADMIN_USER_IDS`.
- Kill switches: `AI_GLOBAL_KILL_SWITCH`, `RAG_UPLOADS_ENABLED`, `AUTOPSY_REPORTS_ENABLED`, `HERMES_WRITES_ENABLED`, `WORKER_AI_ENABLED`.
- Budgets: `GLOBAL_DAILY_AI_BUDGET_USD`, `GLOBAL_DAILY_AI_REQUEST_LIMIT`, `GLOBAL_CHAT_MESSAGES_PER_DAY`.

## Launch Batches

- 10 users: run for 24 hours with daily cost and DLQ checks.
- 25 users: verify Autopsy V3 and RAG upload failure rates stay below 10%.
- 50 users: check queue latency and oldest pending event every day.
- 100 users: keep daily AI spend below budget and worker AI disabled.

## Grant Beta Access

1. Open `/admin/users`.
2. Search by email or user ID.
3. Use Grant beta.
4. Set `manual_plan` to `founding`, `pro`, or `admin` only when intended.

## Suspend Or Revoke

- Suspend: `/admin/users`, add a reason, use Suspend.
- Revoke: `/admin/users`, use Revoke. This removes beta access and returns the user to `free`.

## Pause Features

- Pause AI globally: set `AI_GLOBAL_KILL_SWITCH=true`.
- Pause Autopsy reports: set `AUTOPSY_REPORTS_ENABLED=false`.
- Pause Autopsy uploads: set `AUTOPSY_UPLOADS_ENABLED=false`.
- Pause RAG uploads: set `RAG_UPLOADS_ENABLED=false`.
- Pause RAG queries: set `RAG_QUERIES_ENABLED=false`.
- Pause Hermes writes: set `HERMES_WRITES_ENABLED=false`.
- Keep worker AI off unless explicitly testing: `WORKER_AI_ENABLED=false`.

## Worker Cron

- External cron should POST `/api/internal/workers/process-events` every 5 minutes.
- Header: `Authorization: Bearer INTERNAL_CRON_SECRET`.
- Use `/admin/queue` and `/api/internal/workers/queue-status` to monitor queue health.

## Red Flags Requiring Pause

- DLQ count above 20.
- Oldest pending event above 30 minutes.
- Daily AI spend above budget.
- Autopsy failure rate above 10%.
- Provider error spike.
- Repeated upload failures.
- Any cross-user data issue.
- Chat failures above 5%.

## Rollback

1. Set `AI_GLOBAL_KILL_SWITCH=true`.
2. Set `BACKGROUND_JOBS_ENABLED=false`.
3. Pause risky subsystems with their feature flags.
4. Revert the deployment if errors continue.
5. Keep Supabase migrations forward-only unless a specific rollback SQL is reviewed.

## Support Templates

- Access inactive: "Your beta access is not active yet. Contact admin to activate your account."
- Feature paused: "This feature is temporarily paused during beta maintenance."
- Upload failed: "The file could not be processed safely. Try a selectable-text PDF or TXT file."
- Report failed: "The report did not finish. You can retry safely; duplicate cards and memories are guarded."

## Known Limitations

- Real Stripe payments, payouts, taxes, invoices, and bank setup are disabled.
- OCR/image upload is not part of this pass.
- Hermes remains Lite, with no autonomous agent loop.
- Admin kill-switch changes are environment-driven unless a runtime config store is added later.
