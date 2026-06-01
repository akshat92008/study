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
