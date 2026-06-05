# Canonical Routes

These are the beta-safe routes for the current product surface. Legacy routes must not bypass beta access, usage limits, or expensive-operation guards.

## MIND

- Canonical: `/api/ai/chat`
- Legacy/duplicate routes to keep safe: `/api/ai/tutor`, `/api/ai/mentor`, `/api/ai/autopsy`, `/api/ai/analyze`, `/api/ai/revision-coach`

## Autopsy V3

- Canonical: `/api/autopsy/v3/assessments`
- Canonical: `/api/autopsy/v3/upload`
- Canonical: `/api/autopsy/v3/assessments/[id]`
- Canonical: `/api/autopsy/v3/assessments/[id]/questions`
- Canonical: `/api/autopsy/v3/assessments/[id]/reasons`
- Canonical: `/api/autopsy/v3/answer-key`
- Canonical: `/api/autopsy/v3/assessments/[id]/generate-report`
- Legacy/duplicate routes: `/api/autopsy`, `/api/autopsy/manual`, `/api/autopsy/ingest`, `/api/autopsy/[id]`, `/api/autopsy/questions/[id]`

## RAG

- Canonical: `/api/materials/upload`
- Canonical: `/api/materials/query`
- Canonical: `/api/materials`
- Canonical: `/api/materials/[id]`
- Internal ingestion: `/api/internal/rag/ingest`
- Legacy/duplicate routes: `/api/ingest`, `/api/ingest/[materialId]`

## Revision

- Canonical: `/api/revision`

## Dashboard / COMMAND

- Canonical: `/api/dashboard/session-card`
- Canonical: `/api/dashboard/microtasks`
- Legacy/duplicate routes: `/api/dashboard/complete-session`, `/api/session/complete-session`, `/api/dashboard/session-close`, `/api/session/session-close`

## Practice, Planner, ATLAS

- Canonical: `/api/practice/attempts`
- Canonical: `/api/practice/reviews`
- Canonical: `/api/planner`
- Canonical: `/api/planner/briefing`
- Canonical: `/api/planner/replan`
- Canonical: `/api/atlas/mastery`

## Worker

- Canonical: `/api/internal/workers/process-events`
- Canonical: `/api/internal/workers/queue-status`
- Admin queue controls: `/api/admin/queue/status`, `/api/admin/queue/process`, `/api/admin/queue/retry-dlq`
- Legacy/duplicate health routes should remain admin/cron-only.

## Admin

- Canonical pages: `/admin/launch`, `/admin/users`, `/admin/queue`, `/admin/hermes`
- Canonical APIs: `/api/admin/*`
- Public health: `/api/ping`
- Internal health: `/api/health` and `/api/internal/*` are cron/admin only.

## Deprecated Route Contract

When a legacy route is retired instead of safely forwarded, use `lib/api/deprecated-route.ts`:

```json
{
  "ok": false,
  "error": {
    "code": "deprecated_route",
    "message": "This route is deprecated. Use the current Cognition OS route."
  }
}
```
