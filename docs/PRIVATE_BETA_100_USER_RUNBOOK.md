# Cognition OS 100-User Private Beta Runbook

## Required Environment

- `CRON_SECRET` must be long, random, and at least 24 characters.
- External cron must `POST` `/api/internal/workers/process-events`.
- Vercel Hobby daily cron is backup only, not the primary worker.
- `ENABLE_AGENT_ACTIONS=true` by default for deterministic safe actions.
- AI budget env vars must be configured before inviting users.

## External Cron Setup

POST: `/api/internal/workers/process-events`

Header: `Authorization: Bearer $CRON_SECRET`

Cadence:

- 1-10 users: every 5 minutes
- 10-30 users: every 2 minutes
- 30-100 users: every 1 minute

## Emergency Kill Switches

Disable expensive systems by setting:

- `ENABLE_VISION_UPLOADS=false`
- `ENABLE_RAG_INGESTION=false`
- `ENABLE_AUTOPSY_PROCESSING=false`
- `ENABLE_AGENT_ACTIONS=false`

## Monitoring

Check:

- `/api/admin/queue/status`
- oldest pending event age
- failed event count
- dead-letter count
- RAG failed jobs
- autopsy failed jobs
- daily AI spend
- chat error rate
- upload failure rate

## Stop Conditions

Pause beta if:

- event queue oldest pending age > 15 minutes
- failed event rate > 5%
- AI cost exceeds daily budget
- upload failures exceed 5%
- chat error rate exceeds 3%
- any RLS/security test fails

## Rollout

- Day 1: 5 users
- Day 2: 10 users
- Day 3-4: 30 users
- Day 5+: 100 users only if queue backlog stays healthy

## Before Inviting Users

- [ ] `npm ci` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] `npm run verify:beta` passes
- [ ] Supabase migrations applied cleanly
- [ ] RLS verified
- [ ] `CRON_SECRET` configured and not default
- [ ] External cron is running
- [ ] `/api/admin/queue/status` works
- [ ] AI budget limits configured
- [ ] Safe rule agent actions enabled; emergency kill switch verified
- [ ] Practice attempt route is rate-limited and DB-idempotent
- [ ] RAG internal route uses cron auth, not service-role bearer auth
- [ ] Admin routes use admin auth
- [ ] Internal routes use cron auth
