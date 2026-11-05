# ARCHITECTURE (source of truth: the code; this file explains the "why")

## Components
Next.js client (not built yet) -> Express API (server/) -> PostgreSQL+pgvector (truth) | Redis Stack (cache + job queue) | OpenAI-compatible LLM/embedding API
Rule: Postgres = durable truth. Redis = disposable performance layer. If Redis is down, chat must still work (fallback to RAG).

## Backend layout (server/src)
- config/env.ts      zod-validated env; process exits with a clear message if invalid
- db/                pg pool, migrate.ts (runs migrations/*.sql in order, tracked in schema_migrations), 001_init.sql
- middleware/        auth.ts (JWT -> req.user), errors.ts (AppError, asyncHandler, errorHandler)
- modules/           auth, collections, documents, chat  (routes + service per feature)
- ingestion/         queue.ts (BullMQ), worker.ts (separate process), ingest.ts (pipeline), parsers.ts, cleaner.ts, chunker.ts
- rag/               retriever.ts (pgvector), prompt.ts (system prompt, context framing, follow-up rewrite)
- llm/provider.ts    embeddings + chat via fetch, retry with backoff, dimension check
- cache/             redisClient.ts, types.ts, normalize.ts, eligibility.ts  (+ semanticCache.ts next)
- rag/ and cache/ never import each other. modules/chat orchestrates both.

## Data flow
Upload: API validates + saves file (random name) -> documents row 'queued' -> BullMQ job -> worker: parse -> clean -> chunk (per page) -> embed (batches of 64) -> transaction {delete old chunks, insert new, status=ready, collections.kb_version += 1}.
Chat: auth -> collection ownership -> conversation (create/reuse) -> if history: LLM rewrites question as standalone -> embed -> pgvector top-K (WHERE user + collection + status ready) -> drop below MIN_SIMILARITY -> if none: fixed "not enough information" answer, no LLM call -> else LLM with <context> framing -> citations (only [n] the model used) -> persist messages (+ latency, tokens).

## Key decisions
- Raw SQL + numbered migrations (no ORM): keeps vector queries visible.
- TypeScript, CommonJS output. pdfjs-dist is ESM, loaded via real dynamic import() (parsers.ts). pdf-parse was REJECTED: its bundled 2018 pdf.js failed on a valid PDF.
- Files stored under random UUID names; real content checked via magic bytes.
- Retrieval uses cosine similarity = 1 - (embedding <=> query). HNSW index with vector_cosine_ops. Note: HNSW + WHERE filter can return fewer than K rows on large data (post-filtering); acceptable at this scale, revisit if recall drops.
- Prompt-injection defence: documents wrapped in <source> tags and declared untrusted in the system prompt.
- Embedding dimension 1536 is fixed in the migration; EMBEDDING_DIM must match (checked at runtime).

## Semantic cache design (agreed, partly implemented)
Storage: one Redis HASH per entry, key `nc:cache:{userId}:{collectionId}:{sha256(normalizedQuestion)}`.
  - Exact mode = direct key lookup (no embedding call). Semantic mode = RediSearch KNN over the same hashes.
  - Index: TAG user_id, TAG collection_id, TAG status, NUMERIC kb_version, VECTOR HNSW FLOAT32 DIM 1536 COSINE.
  - KNN query is PRE-FILTERED by user_id + collection_id: `(@user_id:{..} @collection_id:{..})=>[KNN k @embedding $vec AS dist]` (UUIDs need TAG escaping: normalize.escapeTag). similarity = 1 - dist.
  - Redis TTL = CACHE_TTL_SECONDS plus expires_at field.
Gates before serving a candidate (ALL must pass): eligibility(question) | similarity >= threshold | status active | kb_version == current | model == LLM_MODEL | promptVersion == PROMPT_VERSION | not expired | intentCompatible(old,new) | every cited document still exists, ready, same version.
Cache key uses the STANDALONE (rewritten) question, so follow-ups are cached by meaning, not by dangling pronouns. Conversation memory stays separate from the cache.
Known limits (document honestly): the intent guard only catches number and negation mismatches; subtler intent differences rely on the threshold. Default threshold 0.88 is a STARTING VALUE, not a measured one: the benchmark must tune it.
