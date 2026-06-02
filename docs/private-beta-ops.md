# Private Beta Operations Runbook

## Required GitHub secrets
- `COGNITION_WORKER_URL` (must point to /api/internal/workers/process-events)
- `INTERNAL_CRON_SECRET`

## Manual worker curl
```bash
curl -X POST "$COGNITION_WORKER_URL" \
  -H "Authorization: Bearer $INTERNAL_CRON_SECRET" \
  -H "Content-Type: application/json"
```

## Stop onboarding if
- DLQ > 10 unresolved
- oldest pending event > 30 minutes
- chat error rate > 5%
- RAG failed jobs > 20%
- daily budget > 70% before evening
- worker fails 3 consecutive runs

## First 3-user env
```env
ENABLE_AGENT_ACTIONS=false
ENABLE_AI_ESCALATION=true
ENABLE_RAG_INGESTION=true
ENABLE_AUTOPSY_PROCESSING=false
ENABLE_VISION_UPLOADS=false

RAG_MAX_FILE_MB=3
RAG_MAX_FILES_PER_USER=5
RAG_MAX_DAILY_UPLOADS=1
RAG_MAX_CHUNKS_PER_FILE=40
```

## 10-user env after stable alpha
```env
ENABLE_AGENT_ACTIONS=false
ENABLE_AI_ESCALATION=true
ENABLE_RAG_INGESTION=true
ENABLE_AUTOPSY_PROCESSING=true
ENABLE_VISION_UPLOADS=false

RAG_MAX_FILE_MB=5
RAG_MAX_FILES_PER_USER=8
RAG_MAX_DAILY_UPLOADS=1
RAG_MAX_CHUNKS_PER_FILE=60
```
