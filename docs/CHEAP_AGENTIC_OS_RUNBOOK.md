# Cognition OS Cheap Agentic Runbook

## Principle

Rules decide. Database remembers. Events coordinate. Workers execute. AI escalates only when needed.

## Cheap defaults

- `ENABLE_VISION_UPLOADS=true`
- `ENABLE_AGENT_ACTIONS=false`
- `ENABLE_AI_ESCALATION=true`
- `ENABLE_RAG_INGESTION=true`
- `AI_PER_USER_DAILY_BUDGET_USD=0.05`

## External cron

POST `/api/internal/workers/process-events`

Header: `Authorization: Bearer $INTERNAL_INTERNAL_CRON_SECRET`

Cadence:

- 1-10 users: every 5 minutes
- 10-30 users: every 2 minutes
- 30-100 users: every 1 minute

Vercel cron is a backup only. Private beta should use an external cron runner so the event queue is not gated by Hobby cron limits.

## Beta-Allowed Auto-Actions

- update mastery from evidence
- create revision card from verified mistake
- invalidate session card

## Approval-required actions

- replace daily plan
- skip chapter
- reduce test frequency
- run full material analysis
- run vision interpretation
- change exam strategy
- generate large strategy plan

## Stop conditions

Pause beta if:

- oldest pending event > 15 minutes
- failed events > 5%
- AI cost exceeds daily budget
- chat error rate > 3%
- upload failure rate > 5%
- RLS/security test fails
