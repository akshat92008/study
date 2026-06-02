# Beta External Worker Cron

Cognition OS is transitioning away from the weak, low-duration Vercel Hobby tier cron triggers to ensure robust background processing for up to 100 concurrent users. The internal worker route is capable of processing queues with a longer execution time (60 seconds) and requires an external cron runner to trigger it reliably.

## Endpoint

- **URL:** `POST https://<your-deployment-url>/api/internal/workers/process-events`
- **Health Check:** `GET https://<your-deployment-url>/api/internal/workers/process-events`

## Authentication

The endpoint is protected by a Bearer token matching the `INTERNAL_CRON_SECRET` environment variable configured in your Vercel deployment.

**Header:**
```
Authorization: Bearer <YOUR_INTERNAL_CRON_SECRET>
```

## Recommended Cron Runners

For the 100-user private beta, the event worker should be triggered every 1-5 minutes to maintain queue health.

### 1. GitHub Actions (Recommended)

Create a workflow file in `.github/workflows/cron-worker.yml`:

```yaml
name: Event Worker Cron
on:
  schedule:
    - cron: '*/5 * * * *' # Runs every 5 minutes
  workflow_dispatch:

jobs:
  trigger-worker:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger process-events endpoint
        run: |
          curl -X POST "https://${{ secrets.PROD_URL }}/api/internal/workers/process-events" \
          -H "Authorization: Bearer ${{ secrets.INTERNAL_CRON_SECRET }}"
```

### 2. AWS EventBridge / Lambda

You can configure an EventBridge rule that triggers a lightweight Lambda function or directly invokes the HTTPS endpoint using an API destination every minute for lower latency.

### 3. Upstash QStash

Upstash QStash is highly recommended as a serverless cron and messaging system. It guarantees at-least-once delivery and handles retries automatically.
