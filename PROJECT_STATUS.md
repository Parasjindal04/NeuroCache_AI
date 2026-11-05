# PROJECT STATUS (checkpoint, read this first in every new session)

Last updated: end of Session 3
Project root: neurocache-ai/   Backend: server/   Frontend: NOT STARTED   Git: initialized, see `git log`

## How to resume
1. Read this file, TASKS.md, ARCHITECTURE.md, CHANGELOG.md. 2. `git log --oneline` and `git status`. 3. Inspect files before editing (`find server/src -type f`). 4. Continue from the first unchecked item under "NEXT UP" in TASKS.md. Do not rebuild anything marked [x] or [~]; fix it only if the user reports a failure.

## Completed features (verified in sandbox)
- Env validation, migration runner, parsers (PDF per page/DOCX/TXT), cleaner, chunker, HTTP auth/validation layer, cache pure logic (15 tests pass).

## Implemented but NOT verified on a real stack  (sandbox has no Docker/Postgres/Redis/API key)
- Migration 001 applied to a real DB, register/login with DB, collections, upload + worker + embeddings + pgvector insert, RAG chat, conversations.
- Verification needed from the user: `docker compose up -d`, `npm run migrate`, `npm run dev` + `npm run worker`, then `npm run smoke`; report `/api/health` output and any errors. Treat any failure here as the top priority bug before more features.

## Pending features
See TASKS.md. Immediate next: P2-2 Redis cache store (FT.CREATE, store, exact + semantic lookup). Then validation gates, chat integration, invalidation, stats, benchmark; then frontend (Steer style), hybrid retrieval, feedback, analytics, Docker deploy.

## Files modified this session
server/src/config/env.ts, server/.env.example, server/package.json (script test:cache), NEW: server/src/cache/{types,normalize,eligibility}.ts, server/scripts/test-cache-logic.ts, PROJECT_STATUS.md, TASKS.md, ARCHITECTURE.md, CHANGELOG.md

## Known errors / bugs / risks
- None known in verified parts. Unverified: BullMQ v6 + ioredis connection options, HNSW filtered-search recall, `FT.*` commands (not written yet). RedisSearch syntax in P2-2 can only be tested on the user's machine.
- chat.service saves cache_status='none' always until P2-4.
- Default cache threshold 0.88 is unmeasured.

## Environment assumptions
User has NO Docker (i3 10th gen, 8 GB RAM, SSD): use Neon (Postgres+pgvector) and Redis Cloud free plan (Search included per Redis docs, 30 MB / 30 connections). Cache entries must stay small (~6 KB vector each => roughly a few thousand entries max).
OpenAI-compatible provider, text-embedding-3-small (1536 dims), Node 22+, Docker for Postgres + Redis Stack. User is on a low-end PC (Delhi): keep RAM low, worker concurrency 1, no local ML models, defer reranking/Ragas/streaming.

## Exact next steps
1. Ask the user for package 1 verification results (if not yet provided; do not block on it).
2. Write src/cache/semanticCache.ts: ensureIndex() (FT.CREATE if missing, via redis.call), store(entry, vector), exactLookup(userId, collectionId, question), semanticLookup(userId, collectionId, vector, k=3). Use Buffer.from(new Float32Array(vec).buffer) for the vector field; DIALECT 2.
3. Write scripts/test-cache-redis.ts that only runs when Redis Stack is reachable (to be run by the user), covering isolation across users/collections.
4. Update TASKS.md, CHANGELOG.md, this file; commit.
