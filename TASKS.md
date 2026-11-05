# TASKS

Legend: [x] done and verified | [~] implemented, NOT yet verified on a real stack | [ ] not started
Rule: continue ONLY from the first unchecked item in "NEXT UP". Update this file after every major task.

## NEXT UP (in order)
1. [ ] USER ACTION: run package 1 on the real stack and report results (see PROJECT_STATUS.md "Verification needed")
2. [ ] P2-2  Redis cache store: FT.CREATE index + `store()` + `exactLookup()` + `semanticLookup()` (src/cache/semanticCache.ts)
3. [ ] P2-3  Validation gates on a candidate hit (kb_version, model, prompt version, TTL, status, doc-version/citation check)
4. [ ] P2-4  Integrate into chat.service.ts: `cacheMode` param (none|exact|semantic), `bypassCache`, Redis-failure fallback
5. [ ] P2-5  Invalidation: bump handling on document delete/reprocess; TTL; DELETE /api/cache/clear
6. [ ] P2-6  Migration 002: `cache_events`/metrics table; GET /api/cache/stats, GET+PATCH /api/cache/config
7. [ ] P2-7  Benchmark: dataset (6 question types) + runner comparing none/exact/semantic; save results to DB/JSON

## Phase 1: Project initialization
- [x] Monorepo layout, docker-compose (pgvector + redis-stack), env validation (zod)
- [x] Health endpoint (checks Postgres, pgvector, Redis, RediSearch)  [~] live check pending user run

## Phase 2: Auth + database
- [x] Migration runner + 001_init.sql (all tables)  [~] not yet applied to a real DB
- [~] Register / login / me, bcrypt + JWT, rate limit (HTTP validation paths tested; DB paths untested)
- [~] Collections CRUD

## Phase 3-4: Upload, ingestion, embeddings
- [~] Upload (multer, type + magic-byte validation, size limit), list/get/delete/reprocess
- [x] Parsers verified in sandbox: PDF (per page), DOCX, TXT
- [x] Cleaner + chunker verified in sandbox
- [~] BullMQ queue + worker + embedding + pgvector insert (needs real Redis/Postgres/API key)

## Phase 5: Basic RAG
- [~] Retriever (cosine, user+collection filtered), prompt (untrusted-context defence), citations, follow-up rewrite, no-info fallback
- [ ] Streaming responses (deferred to the end)

## Phase 6-7: Semantic cache
- [x] P2-1 Pure logic: types, normalization/hash, cacheability rules, intent guard (15 unit tests: `npm run test:cache`)
- [ ] P2-2 .. P2-6: see NEXT UP

## Phase 8: Advanced retrieval
- [ ] Postgres full-text (BM25-style) search, hybrid fusion (RRF), query rewriting (follow-up rewrite already exists), reranking (hosted API or LLM-based; no local model, low-end PC)

## Phase 9: Memory + feedback
- [~] Conversation history + follow-ups (in chat service)
- [ ] POST /api/feedback

## Phase 10: Analytics + evaluation
- [ ] Analytics endpoints, benchmark dataset/runner (P2-7), retrieval/answer metrics, results stored in DB

## Phase 11: Security hardening
- [~] Done so far: zod validation, helmet, rate limits, upload validation, user-scoped queries, prompt-injection framing
- [ ] Remaining: cache isolation tests, request-id logging review, LLM-failure paths test

## Phase 12: Deploy + docs
- [ ] Dockerfiles, README polish, ER + architecture diagrams, screenshots, resume text (only verified claims)

## Package 3: Frontend (Steer style: see docs/design-tokens.md)
- [ ] Next.js app shell + theme tokens (Fraunces/Inter, cream/maroon/rust, light+dark)
- [ ] Landing, login/register, dashboard, documents + upload, chat (hit/miss badge, citations panel), history, cache analytics, RAG analytics, settings
