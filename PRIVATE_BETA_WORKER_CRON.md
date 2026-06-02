# Cognition OS Worker/Cron Setup for Vercel Hobby

## Why
Vercel Hobby cron only runs daily, so event processing needs either:
- daily Vercel cron as backup
- external cron every 10–15 minutes for private beta
- manual trigger during testing

## Vercel Cron
vercel.json:
{
  "crons": [
    {
      "path": "/api/internal/workers/process-events",
      "schedule": "0 0 * * *"
    }
  ]
}

## External Cron
Use a service like cron-job.org, EasyCron, GitHub Actions schedule, or similar.

Request:
POST https://YOUR_DOMAIN/api/internal/workers/process-events

Header:
Authorization: Bearer YOUR_CRON_SECRET

Frequency:
Every 10–15 minutes for private beta.

## Manual Test
curl command:
curl -X POST "https://YOUR_DOMAIN/api/internal/workers/process-events" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

Expected response:
{
  "ok": true,
  "processed": 0,
  "failed": 0,
  "durationMs": 123
}

## Security
- never expose INTERNAL_CRON_SECRET
- rotate INTERNAL_CRON_SECRET if leaked
- route must reject missing/wrong Authorization
- do not put secret in frontend code
- do not log secret

## Monitoring
Check these tables daily:
- event_queue
- consumer_locks
- chat_messages
- session_cards
- mock_autopsies
- mistakes
- concepts
- revision_cards

Warning signs:
- consumer_locks stuck in pending/running
- repeated failed locks
- event_queue growing continuously
- autopsy events not creating memory cards
- session completion not updating mastery
