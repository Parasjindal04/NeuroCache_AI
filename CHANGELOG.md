# CHANGELOG

## Session 3
- chore: NVM support: .nvmrc (22), engines >=22 in server/package.json, server/.npmrc engine-strict, README section for nvm-windows and nvm-sh.
- Added tracking docs (PROJECT_STATUS, TASKS, ARCHITECTURE, CHANGELOG) and git history.
- feat(cache): types, question normalization + sha256 key, tag escaping, cacheability rules (time-sensitive, user-specific, too short, dangling reference), intent guard (numbers, negation). 15 unit tests.
- fix(cache): normalization stripped Unicode combining marks, corrupting Hindi/Devanagari text. Now keeps \p{M}.
- config: CACHE_SIMILARITY_THRESHOLD (0.88), CACHE_TTL_SECONDS (86400), PROMPT_VERSION (v1), all with defaults.

## Session 2: Package 1 (backend core)
- Auth, collections, documents (upload/list/get/delete/reprocess), BullMQ ingestion worker, RAG chat with citations, conversations, health, smoke script, README.
- fix: replaced pdf-parse with pdfjs-dist (old bundled pdf.js threw "bad XRef entry" on a valid PDF); fixed `destroy()` being called on the wrong object.
- Verified in sandbox: typecheck, chunker, PDF/DOCX/TXT parsing, HTTP auth/validation/404 behaviour.

## Session 1: Phase 1
- Architecture, folder structure, docker-compose, Express + health route, Next.js scaffold instructions.
