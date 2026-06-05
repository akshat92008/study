# Private Beta Environment Checklist

## Core
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## RAG
- `RAG_MAX_FILE_MB` default `20`
- `RAG_MAX_FILES_PER_USER` default `5`
- `RAG_MAX_CHUNKS_PER_FILE` default `160`
- `RAG_CHUNK_SIZE_CHARS` default `3200`
- `RAG_CHUNK_OVERLAP_CHARS` default `450`
- `RAG_TOP_K` default `5`
- `RAG_MAX_CONTEXT_CHARS` default `10000`
- `RAG_MIN_SIMILARITY` default `0.68`
- `RAG_ENABLE_OCR` default `false`
- `RAG_REQUIRE_CITATIONS` default `true`

## AI Providers
- Configure at least one embedding-capable provider from the existing AI router priority.
- `CLOUDFLARE_API_TOKEN` / account config if Cloudflare embeddings are used.
- `SAMBANOVA_API_KEY` if SambaNova embeddings are used.
- `GEMINI_API_KEY` optional fallback, not required for normal text RAG.
- `OPENAI_API_KEY` optional paid fallback only when spend controls are configured.

## Amaura Agent Runtime
- `ENABLE_AGENT_RUNTIME` default `true`
- `ENABLE_AGENT_BACKGROUND_JOBS` default `true`
- `ENABLE_AGENT_LLM_CALLS` default `false`
- `AGENT_BACKGROUND_MODEL` default `gemini-flash`
- `MAX_AGENT_AI_CALLS_PER_USER_PER_DAY` default `3`
- `MAX_AGENT_AI_CALLS_PER_USER_PER_MONTH` default `50`
- `MAX_AGENT_AI_CALLS_GLOBAL_PER_DAY` default `500`
- `MAX_AGENT_RETRIES_PER_JOB` default `2`
- `MAX_FLASHCARDS_PER_CONCEPT_PER_7_DAYS` default `5`

## Worker Cron
- `INTERNAL_CRON_SECRET` required for `/api/internal/workers/process-events`.
- `INTERNAL_WORKER_SECRET` optional alternate header secret for external workers.
- `EVENT_WORKER_BATCH_SIZE` default `10`
- `EVENT_WORKER_MAX_RUNTIME_MS` default `8000`
- `EVENT_WORKER_MAX_AI_CALLS_PER_RUN` default `3`
- `EVENT_WORKER_MAX_EVENTS_PER_USER_PER_RUN` default `3`
- External free cron should call `POST /api/internal/workers/process-events` every 5-10 minutes.
- Vercel cron must remain daily-only: `/api/cron/daily-synthesis` at `0 6 * * *`.

## Product Gates
- `ENABLE_PUBLIC_SIGNUP=false`
- `ENABLE_BILLING_AUTOMATION=false`
