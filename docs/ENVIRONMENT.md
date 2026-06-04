# Environment

## Required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_CRON_SECRET`
- `ADMIN_EMAILS`

## Public Beta Gate

- `PUBLIC_BETA_MODE=true`
- `REQUIRE_INVITE_CODE=true`
- `MAX_BETA_USERS=300`
- `BETA_INVITE_CODES=code-1,code-2`

## Worker

- `INTERNAL_CRON_SECRET`
- `INTERNAL_WORKER_SECRET`
- `EVENT_WORKER_BATCH_SIZE=25`
- `EVENT_WORKER_LEASE_MINUTES=5`
- `EVENT_WORKER_MAX_RUNTIME_MS=50000`
- `EVENT_COALESCE_WINDOW_SECONDS=120`
- `DAILY_USER_EVENT_LIMIT=500`

## AI Cost Defaults

- `AI_COST_MODE=ultra_cheap`
- `ENABLE_PAID_AI_FALLBACK=false`
- `ENABLE_ANTHROPIC_AI=false`
- `ENABLE_GOOGLE_AI=false`
- `MAX_CHAT_HISTORY_MESSAGES=6`
- `MAX_RAG_CHUNKS=3`
- `MAX_AI_OUTPUT_TOKENS=500`
- `MAX_AI_INPUT_CHARS=12000`
- `DAILY_USER_AI_REQUEST_LIMIT=30`
- `DAILY_GLOBAL_AI_REQUEST_LIMIT=1000`

AI provider keys are optional. If none are configured, the app should boot and AI routes should use deterministic fallbacks or friendly degradation.

## Optional AI Providers

- `CEREBRAS_API_KEY`
- `SAMBANOVA_API_KEY`
- `GROQ_API_KEY`
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY` only if paid fallback is intentionally enabled

## Upload / RAG Caps

- `ENABLE_RAG_INGESTION=true`
- `RAG_MAX_FILE_MB=10`
- `RAG_MAX_FILES_PER_USER=5`
- `RAG_MAX_DAILY_UPLOADS=5`
- `RAG_MAX_CHUNKS_PER_FILE=40`

## Emergency Switches

- `AI_DISABLED=true` pauses model calls.
- `ENABLE_RAG_INGESTION=false` accepts uploads without indexing.
- `ENABLE_AUTOPSY_PROCESSING=false` prevents async autopsy processing.
- `ENABLE_AGENT_ACTIONS=false` keeps proposed agent actions disabled.
