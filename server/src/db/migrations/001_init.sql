CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- kb_version increases whenever a document in the collection is added/changed/removed.
-- The semantic cache (package 2) stores this number and rejects entries from older versions.
CREATE TABLE collections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  kb_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  filename      text NOT NULL,
  stored_path   text NOT NULL,
  file_type     text NOT NULL CHECK (file_type IN ('pdf','docx','txt')),
  size_bytes    integer NOT NULL,
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','ready','failed')),
  error_message text,
  page_count    integer,
  chunk_count   integer NOT NULL DEFAULT 0,
  chunk_size    integer NOT NULL,
  chunk_overlap integer NOT NULL,
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_collection ON documents(collection_id);

CREATE TABLE document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content     text NOT NULL,
  page_number integer,
  embedding   vector(1536) NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);
-- HNSW = approximate nearest-neighbour graph index. vector_cosine_ops matches the <=> operator.
CREATE INDEX idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  title         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_user ON conversations(user_id, created_at DESC);

CREATE TABLE messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role              text NOT NULL CHECK (role IN ('user','assistant')),
  content           text NOT NULL,
  citations         jsonb NOT NULL DEFAULT '[]',
  cache_status      text NOT NULL DEFAULT 'none' CHECK (cache_status IN ('none','miss','hit_exact','hit_semantic')),
  latency_ms        integer,
  prompt_tokens     integer,
  completion_tokens integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  rating     text NOT NULL CHECK (rating IN ('helpful','not_helpful','incorrect','missing_info')),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);
