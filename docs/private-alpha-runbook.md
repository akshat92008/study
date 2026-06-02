# Private Alpha Runbook (10 Users)

## Cron & Background Workers

Vercel Hobby plan only supports cron once a day. For this 10-user alpha, you MUST configure an external cron service (like cron-job.org or GitHub Actions) to run the event queue frequently.

**Endpoint:**
`POST https://<your-domain>/api/internal/workers/process-events`

**Headers:**
`Authorization: Bearer <YOUR_INTERNAL_CRON_SECRET>`

**Frequency:**
Run this every 1 to 5 minutes.

### Setting `INTERNAL_INTERNAL_CRON_SECRET`
- The `INTERNAL_INTERNAL_CRON_SECRET` must be set in your Vercel Environment Variables.
- It is the shared secret that authenticates your external cron runner.
- Do NOT use the default `super_secret_cron_token_123` in production.

## Checking Queue Health

You can check the health of the background system by visiting:

`GET https://<your-domain>/api/admin/system/status`

**Note:** You must either be authenticated as an Admin user, or you can send `Authorization: Bearer <YOUR_INTERNAL_CRON_SECRET>` to the endpoint. URL query secrets (`?secret=`) have been disabled for security.

### Interpreting Health Status

- **GREEN:** DLQ is 0, oldest pending event is < 10 mins old, and no stuck locks. Everything is fine.
- **YELLOW:** DLQ > 0 but small, or oldest pending event is 10-30 mins old. This means some retries are happening. It may resolve itself.
- **RED:** Oldest pending > 30 mins, DLQ is growing, or stuck locks exist. Worker is likely not running or failing completely.

### Troubleshooting RED Health

1. **Check your external cron runner:** Is it hitting `/api/internal/workers/process-events` successfully every 5 minutes? Check the runner's logs.
2. **Check Vercel Server Logs:** Look for errors from the `event-worker` feature.
3. **Check DLQ:** The admin status route will list the 10 most recent failures in the DLQ. If a specific provider API is down (like Groq/Cloudflare), wait for it to recover. The queue locks events safely in the meantime.
4. **Manual Retry:** You can manually trigger `/api/internal/workers/process-events` if the cron service stops working.
