# Cognition OS Private-Beta Handoff

## Current Status
- typecheck: PASS
- lint: PASS (0 errors, 176 warnings)
- tests: PASS (188/188 passed)
- build: PASS (Compiled successfully)
- verify:db: PASS (All Database Smoke Tests Passed!)
- latest migration: 20260601120000_source_material_rag.sql
- migration count: 59
- PULSE runtime: Excluded / absent
- streak behavior: PASS (Updates correctly to 1)
- autopsy ingest: PASS (Ingested successfully, mistakes linked)
- event worker: PASS (Event enqueued and processed successfully)

## Required Production Env Vars
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_APP_URL

## Optional Env Vars
- GEMINI_API_KEY (Google Gemini AI provider, used for embeddings and generation)
- STRIPE_SECRET_KEY (Stripe Billing)
- STRIPE_WEBHOOK_SECRET (Stripe Webhook integration)
- STRIPE_PRO_PRICE_ID (Stripe Pricing)

## Study Material / RAG
- Upload route: `POST /api/materials/upload`
- List route: `GET /api/materials`
- Detail/delete route: `GET|DELETE /api/materials/:id`
- Query route: `POST /api/materials/query`
- Reprocess route: `POST /api/materials/:id/reprocess`
- Supported files: text PDFs, TXT, Markdown
- Default limits: 20MB/file, 5 active files/user, 160 chunks/file, topK 5, max RAG context 10k chars
- Normal text RAG does not require Gemini; it uses the existing router for embeddings/final answers and keyword fallback if embeddings are unavailable.
- Scanned PDFs/images are OCR-limited while `RAG_ENABLE_OCR=false`.
- See `PRIVATE_BETA_ENV_CHECKLIST.md` for RAG env vars.

## Deployment Steps
- Vercel env setup
- Supabase env setup
- build command (`npm run build`)
- post-deploy verify command (`npm run verify:db`)
- worker/cron setup (See [PRIVATE_BETA_WORKER_CRON.md](./PRIVATE_BETA_WORKER_CRON.md))

## Manual Smoke Test
- signup/login
- daily card
- chat persistence
- session completion
- streak updates to 1
- event worker processes
- autopsy ingest
- study material upload and cited MIND answer
- verified mistake
- ATLAS update
- MEMORY card created
- next card adapts

## Known Limitations
- local supabase db reset not proven if still unavailable
- private beta only, 5–10 users
- monitor event_queue and consumer_locks daily
