# Cron Setup

Vercel Hobby cron can run daily only. Cognition OS can keep the daily Vercel cron as a backup, but public beta should use an external cron that calls the worker every 5-15 minutes.

## Endpoint

- URL: `/api/internal/workers/process-events`
- Method: `POST`
- Auth header: `Authorization: Bearer $INTERNAL_CRON_SECRET`
- Alternate worker header: `x-internal-worker-secret: $INTERNAL_WORKER_SECRET`

## Recommended Beta Schedule

- Every 15 minutes for small public beta.
- Every 5 minutes only if uploads, autopsy jobs, or queue depth grow.
- Keep `EVENT_WORKER_BATCH_SIZE` at `25` until queue depth proves this is too low.

## GitHub Actions Cron

This repo includes `.github/workflows/cron-worker.yml`.

Required repository secrets:

- `COGNITION_WORKER_URL`: full production worker URL, for example `https://app.example.com/api/internal/workers/process-events`
- `INTERNAL_CRON_SECRET`: same secret configured in production

Disable the workflow by disabling it in GitHub Actions if another cron provider is used.

## Other Cron Options

- cron-job.org
- EasyCron
- UptimeRobot-style scheduled pings
- A small Cloudflare Worker cron trigger

## Manual Run

Use an authenticated admin route or call:

```bash
curl --fail --request POST \
  --header "Authorization: Bearer $INTERNAL_CRON_SECRET" \
  "$COGNITION_WORKER_URL"
```

The worker response includes processed, failed, skipped, dead-letter count, duration, queue health, and next recommended run interval.
