# Founder Operations

## Daily Checks

- Open `/admin/queue` and check pending, processing, failed, and dead-letter counts.
- Check `/api/admin/dashboard` as an admin for queue, AI usage, autopsy, and recent error status.
- Confirm the external cron workflow or cron provider has run in the last 15 minutes.
- Review failed RAG and autopsy jobs before increasing beta seats.
- Check AI usage and keep `AI_COST_MODE=ultra_cheap` for public beta.

## Run Worker Manually

```bash
curl --fail --request POST \
  --header "Authorization: Bearer $INTERNAL_CRON_SECRET" \
  "$COGNITION_WORKER_URL"
```

Use this when materials stay queued, autopsy jobs do not move, or the event queue grows.

## Retry Failed Jobs

- User-visible material failures can be retried from the source card when `retryable=true`.
- Queue DLQ recovery is available through admin queue routes.
- RAG retries call `POST /api/materials/{id}/reprocess` for the owning user.

## Disable AI

Set:

```bash
AI_DISABLED=true
AI_COST_MODE=ultra_cheap
ENABLE_PAID_AI_FALLBACK=false
```

The chat route should keep deterministic and rule-first behavior where available.

## Pause Onboarding

Set:

```bash
PUBLIC_BETA_MODE=true
REQUIRE_INVITE_CODE=true
BETA_INVITE_CODES=
MAX_BETA_USERS=1
```

Public visitors can still use `/waitlist`.

## Handle Rate Limits

- For AI overuse, lower `DAILY_USER_AI_REQUEST_LIMIT` or `DAILY_GLOBAL_AI_REQUEST_LIMIT`.
- For chat spam, lower `FREE_DAILY_CHAT_LIMIT` and `FREE_HOURLY_CHAT_LIMIT`.
- For upload abuse, lower `RAG_MAX_DAILY_UPLOADS`, `RAG_MAX_FILES_PER_USER`, or `RAG_MAX_FILE_MB`.

## Public Beta Go / No-Go

Proceed only when:

- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- Worker endpoint rejects unauthenticated requests and accepts the configured secret.
- New custom-goal onboarding reaches dashboard.
- Material status moves through queued, processing, ready, or failed.
- AI routes degrade gracefully without provider keys.
