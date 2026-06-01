# Source-Grounded RAG Implementation Report

## Executive Status
- RAG built: YES
- NotebookLM-level source Q&A: YES for text PDFs/TXT/Markdown Q&A, summaries, MCQs, flashcards, comparisons, and study-guide generation through MIND
- Cost optimized: YES
- Gemini dependency removed for normal text RAG: YES

## Starting Audit
- Existing state had a disabled `/api/ingest` route and a lightweight `lib/engines/rag-engine.ts` using legacy `materials` / `material_chunks`.
- Existing schema already had pgvector, semantic memory, and older `match_material_chunks` RPCs.
- Chat already accepted `ragChunks` in MIND context, but retrieval was minimal and citations were not strict.
- Practice evidence loop existed, but MCQ answer checking used raw string equality and MEMORY ignored `forgot` flashcard reviews.

## Architecture
- Tables: `study_materials`, `study_material_chunks`, and `rag_query_logs`.
- Upload API: `POST /api/materials/upload` validates MIME, size, magic bytes, active-file limit, duplicate content hash, user-scoped storage path, and then ingests synchronously.
- Extraction: local text extraction for PDF via `pdf-parse`; TXT/Markdown decode directly; scanned/image-only PDFs fail safely unless OCR is enabled later.
- Chunking: page-aware chunks with heading inference, content hashes, token estimates, overlap, dedupe, and max chunk caps.
- Embeddings: existing AI router via `getEmbedding`, with budget guard and provider priority inherited from router config. If providers are missing, chunks are stored and keyword fallback remains available.
- Retrieval: vector RPC `match_study_material_chunks` filters by `user_id` inside SQL; keyword fallback is user-scoped; reranking boosts keyword overlap, source diversity, and NCERT source type when asked.
- MIND integration: RAG remains an enhancer. Explicit source requests with no evidence produce a prompt instruction to say the uploaded material did not contain enough support.
- Citations: prompt includes citation rules and retrieved chunks carry material title, page, heading, and citation labels.

## Cost Controls
| Call site | Purpose | Provider route | Budget guard | Cap | Gemini required | Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| `lib/rag/extractors.ts` | PDF/TXT text extraction | local | n/a | file size | NO | fail as OCR-limited |
| `lib/rag/ingest.ts` | chunk embeddings | `router:embedding` | YES | `RAG_MAX_CHUNKS_PER_FILE`, 8k chars/input | NO | store chunks without embeddings |
| `lib/rag/retrieval.ts` | query embedding | `router:embedding` | YES | one query embedding | NO | keyword fallback |
| `app/api/ai/chat/route.ts` | final MIND answer | existing chat router | YES | existing prompt/token budget + RAG context cap | NO | normal MIND answer |

Defaults:
- `RAG_MAX_FILE_MB=20`
- `RAG_MAX_FILES_PER_USER=5`
- `RAG_MAX_CHUNKS_PER_FILE=160`
- `RAG_TOP_K=5`, hard max 8
- `RAG_MAX_CONTEXT_CHARS=10000`
- `RAG_ENABLE_OCR=false`

## Security / Privacy
- RLS enabled on all new RAG tables.
- Storage bucket `study-materials` is private and path-scoped by `user_id`.
- Vector match RPC rejects cross-user calls unless called by service role.
- Service role remains server-only through `createAdminClient`.
- Deleted materials are archived and storage objects are removed.
- Answers are prompted to paraphrase and avoid long copyrighted excerpts.

## Practice Integration
- RAG-grounded MCQ/flashcard artifacts are stored as practice sets with `source='rag'`.
- Practice items can store `source_material_id` and `source_chunk_ids`.
- MCQ answer normalization now handles `A`, `(A)`, `Option A`, `A) text`, and answer text.
- Flashcard `again`, `forgot`, and `hard` are weak signals for MEMORY.
- ATLAS attempts to resolve concept names when `concept_id` is absent.

## Tests Added
- `tests/practice/answer-normalization.test.ts`
- `tests/rag/ragChunking.test.ts`
- `tests/rag/ragPromptGrounding.test.ts`

## Current Limitations
- OCR and diagram understanding are not enabled by default.
- Very large books are capped by file size, chunk count, and context size.
- DOCX is not enabled because no safe existing product path depended on it.
- `/api/ingest` remains disabled; the supported material API is `/api/materials/*`.
