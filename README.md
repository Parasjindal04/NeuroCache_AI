# NeuroCache AI: Package 1 (Backend core)

Auth, collections, document upload + background ingestion, and RAG chat with citations.
Semantic cache, analytics and benchmarks arrive in package 2. The Steer-style frontend arrives in package 3.

## What you need installed
| Tool | Check | Notes |
|---|---|---|
| Node.js 22 (via NVM, see below) | `node -v` | install NVM first, then Node |
| Git | `git --version` | |
| Docker Desktop | `docker --version` | Windows: enable WSL2. Low RAM? See "Low-end PC" below |
| An OpenAI-compatible API key | | Needs a chat model AND an embeddings model |

Windows: run all commands in **Git Bash** (installed with Git).

## Node version (NVM)
This project is pinned to **Node 22** (`.nvmrc` in the project root, `engines` in `server/package.json`).
`server/.npmrc` sets `engine-strict=true`, so `npm install` fails with a clear message on the wrong Node version.

**Windows** (use *nvm-windows*: https://github.com/coreybutler/nvm-windows/releases, install `nvm-setup.exe`, then open a NEW terminal, as Administrator the first time):
```bash
nvm install 22
nvm use 22
node -v        # v22.x.x
```
nvm-windows does NOT read `.nvmrc` automatically, so run `nvm use 22` in each new terminal.
If you already have Node installed from nodejs.org, uninstall it first, or `nvm use` may not take effect.

**macOS / Linux / WSL** (https://github.com/nvm-sh/nvm):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# restart the terminal, then, in the project root:
nvm install      # reads .nvmrc
nvm use          # reads .nvmrc
node -v
```
Using Docker for Postgres/Redis is unaffected by NVM.

## Setup (one time)

**1. Start Postgres and Redis.** Run in the project root (`neurocache-ai/`):
```bash
docker compose up -d
docker compose ps
```
Postgres should say `healthy`, Redis `running`.

**2. Install backend packages.** Run in `neurocache-ai/server/`:
```bash
cd server
npm install
```

**3. Configure environment.** Run in `neurocache-ai/server/`:
```bash
cp .env.example .env
```
Open `server/.env` and set:
- `JWT_SECRET`: generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `LLM_API_KEY`: your key. For another provider also set `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`

> Embedding size: the DB column is `vector(1536)`, which matches OpenAI `text-embedding-3-small`.
> A model with a different size needs a new migration and a matching `EMBEDDING_DIM`.

**4. Create the database tables.** In `server/`:
```bash
npm run migrate
```
You should see `applied 001_init.sql`.

## Run (two terminals, both in `server/`)
```bash
npm run dev       # terminal 1: the API on http://localhost:4000
npm run worker    # terminal 2: background ingestion worker
```
Open http://localhost:4000/api/health. Expect `{"status":"ok","postgres":true,"pgvector":true,"redis":true,"redisSearch":true}`.

## Verify everything end to end (third terminal, in `server/`)
```bash
npm run smoke
```
It registers a user, creates a collection, uploads `docs/sample-ml-notes.txt`, waits for ingestion, asks a question, asks a follow-up, and asks something outside the document. Expected: grounded answers with citations, the follow-up rewritten as a standalone question, and "I don't have enough information..." for the off-topic one.

## API (all except auth and health need `Authorization: Bearer <token>`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | returns `{ user, token }` |
| GET | `/api/auth/me` | current user |
| POST / GET / DELETE | `/api/collections`, `/api/collections/:id` | knowledge bases |
| POST | `/api/documents/upload` | multipart: `file`, `collectionId`, optional `chunkSize`, `chunkOverlap` |
| GET | `/api/documents?collectionId=` , `/api/documents/:id` | list / status |
| DELETE | `/api/documents/:id` | remove document, chunks and file |
| POST | `/api/documents/:id/reprocess` | re-ingest, optional new chunk settings |
| POST | `/api/chat` | `{ question, collectionId, conversationId? }` |
| GET / DELETE | `/api/conversations`, `/api/conversations/:id` | history |

## How it is built
- `src/ingestion/`: parsers (PDF per page / DOCX / TXT), cleaner, chunker, worker (BullMQ)
- `src/rag/`: retriever (pgvector cosine search, user + collection filtered) and prompt builder (documents treated as untrusted data)
- `src/llm/provider.ts`: embeddings + chat via plain `fetch`, with retry and backoff
- `src/modules/*`: feature routes and services
- `src/cache/`: reserved for the semantic cache (package 2)

## Troubleshooting
| Symptom | Fix |
|---|---|
| `Invalid environment variables` on start | the named variable is missing or invalid in `server/.env` |
| `/api/health` shows `redisSearch:false` | you are not on the `redis/redis-stack` image |
| Port 5432 in use | stop local Postgres, or map `"5433:5432"` in compose and update `DATABASE_URL` |
| Document stuck on `queued` | the worker (`npm run worker`) isn't running |
| Document `failed` | `GET /api/documents/:id` and read `error_message` (scanned PDFs have no text) |
| 502 "The AI provider failed" | wrong key/model/base URL; the real provider error is in the API terminal |
| `Embedding dimension X != EMBEDDING_DIM` | embedding model size differs from the DB column |

## Low-end PC
Create `C:\Users\<you>\.wslconfig` with `[wsl2]` / `memory=2GB` / `processors=2`, then `wsl --shutdown`.
The worker already runs one job at a time. Don't start the frontend while testing the backend.

## Reset everything (deletes all data)
```bash
docker compose down -v
```
