# Fix Critical Reliability Issues in Cognition OS

## Goal Description

Bring Cognition OS to a stable MVP state by addressing the remaining broken or partially‑fixed components identified in the second‑pass audit. This includes:
- Ensuring atomic DB operations for event creation and consumer registration.
- Making fire‑and‑forget processing truly durable with proper timeout handling and faster retry.
- Implementing persistent provider health tracking and circuit‑breaker logic.
- Wiring a real rate‑limiter into API routes and exposing safe defaults.
- Strengthening observability with OpenTelemetry, structured logs, and alerting.
- Adding missing tests for core engines.
- Improving DLQ retry cadence and exposing manual replay endpoints.

## User Review Required

[!IMPORTANT]
- Confirm acceptance of the overall plan before we start making code changes.
- Let us know if you prefer a different retry frequency (e.g., hourly instead of daily) or have a preferred library for circuit‑breaking (e.g., `opossum`).

## Open Questions

- **Transaction strategy:** Should we use Supabase's `rpc` (Postgres function) to wrap inserts in a single transaction, or rely on the built‑in `supabase.from(...).insert(...).select(...).single()` with explicit `begin`/`commit` via `rpc`?
- **Retry cadence:** Do you want the DLQ retry cron to run every hour (via Vercel cron) instead of once a day?
- **Rate‑limit bucket:** What limits would you like per user (e.g., 30 requests/minute)?
- **Observability backend:** Do you have a tracing backend (e.g., Jaeger, Honeycomb) configured, or should we emit to console only?

## Proposed Changes

---
### Database Transaction Safety
- **File:** `lib/events/orchestrator.ts`
  - Introduce a new helper `createEventWithConsumers` that performs a single PostgreSQL transaction via Supabase RPC (`supabase.rpc('create_event_with_consumers', {...})`).
  - Create the corresponding Postgres function `create_event_with_consumers` in a migration file.

---
### Fire‑and‑Forget Durability
- **File:** `lib/events/orchestrator.ts`
  - Reduce consumer timeout to 10 s and surface timeout errors to the client via an `event_status` endpoint.
  - Add a fallback that re‑queues the event to a Redis queue for immediate retry.
- **File:** `lib/queues/redisQueue.ts`
  - Extend the in‑memory queue to a proper Redis stream based queue using Upstash; ensure `enqueue` writes to Redis and `process` reads from it.

---
### Provider Health & Circuit‑Breaker
- **File:** `lib/events/agents/provider-health.ts` (added above).
- **File:** `lib/events/agents/providers.ts`
  - Wrap each external LLM/provider call with `withProviderHealth`.
  - Before calling a provider, check `isProviderHealthy`; if unhealthy, fall back to a secondary provider.
- **File:** `lib/events/agents/router.ts`
  - Add logic to select provider based on health status.

---
### Rate Limiter Integration
- **File:** `lib/queues/rateLimit.ts` (new file).
  - Export a `rateLimiter` middleware that uses `getRedisClientSafe()` and a token bucket algorithm.
  - Apply this middleware to all API routes under `/api/*` in `pages/api/_middleware.ts`.

---
### Observability & Metrics
- **File:** `lib/queues/otel.ts`
  - Initialise OpenTelemetry SDK with a console exporter (or environment‑provided endpoint).
  - Add spans around `publish`, `processConsumer`, and `retryFailedEvents`.
- **File:** `lib/queues/metrics.ts`
  - Export Prometheus‑style metric helpers (event latency, consumer success/failure counters).
  - Expose `/api/metrics` endpoint for scraping.

---
### DLQ Retry Cadence & Manual Replay
- **File:** `lib/events/retry.ts`
  - Change the cron schedule to hourly (`cron: '0 * * * *'`).
  - Add a new API route `/api/events/retry-now` that triggers `retryFailedEvents` on demand (protected by a secret header).
- **File:** `lib/events/replay.ts`
  - Ensure `replayDLQEvent` returns a proper HTTP response with the new event ID.

---
### Test Coverage
- Add integration tests for the new transaction RPC, rate‑limiter middleware, and provider health fallback.
- Update CI to run `jest --coverage` and enforce >80 % coverage for core engines.

---
### Miscellaneous Clean‑ups
- Remove any unused imports and dead code in `lib/queues/redisQueue.ts`.
- Ensure all `console.log` statements are replaced with `logger.info`.
- Add TypeScript strictness (`noImplicitAny`, `strictNullChecks`).

## Verification Plan

- **Automated tests:** Run the new Jest suites; verify that events created via the RPC are persisted with consumer rows atomically.
- **Manual validation:** Simulate a burst of 200 events; ensure no events remain pending after the hourly retry runs.
- **Observability check:** Confirm traces appear in the configured backend and that metric endpoint returns data.
- **Rate‑limit test:** Exceed the defined bucket and verify a `429` response.

---
