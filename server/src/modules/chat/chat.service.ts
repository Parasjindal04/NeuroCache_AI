import { env } from "../../config/env";
import { pool } from "../../db/postgres";
import { complete, embed, ChatMessage } from "../../llm/provider";
import { AppError } from "../../middleware/errors";
import { buildMessages, buildRewriteMessages } from "../../rag/prompt";
import { retrieve } from "../../rag/retriever";

const NO_INFO = "I don't have enough information in your documents to answer that.";
const HISTORY_LIMIT = 6; // last 6 messages = 3 exchanges

export async function ask(p: { userId: string; question: string; collectionId: string; conversationId?: string }) {
  const t0 = Date.now();

  // 1. authorization: the collection must belong to this user
  const col = await pool.query("SELECT id FROM collections WHERE id=$1 AND user_id=$2", [p.collectionId, p.userId]);
  if (!col.rowCount) throw new AppError(404, "Collection not found");

  // 2. conversation: reuse (ownership + collection check) or create
  let conversationId = p.conversationId;
  let history: ChatMessage[] = [];
  if (conversationId) {
    const conv = await pool.query("SELECT collection_id FROM conversations WHERE id=$1 AND user_id=$2", [conversationId, p.userId]);
    if (!conv.rowCount) throw new AppError(404, "Conversation not found");
    if (conv.rows[0].collection_id !== p.collectionId) throw new AppError(400, "Conversation belongs to a different collection");
    const h = await pool.query(
      "SELECT role, content FROM (SELECT role, content, created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT $2) t ORDER BY created_at",
      [conversationId, HISTORY_LIMIT]
    );
    history = h.rows;
  } else {
    const created = await pool.query(
      "INSERT INTO conversations (user_id, collection_id, title) VALUES ($1,$2,$3) RETURNING id",
      [p.userId, p.collectionId, p.question.slice(0, 60)]
    );
    conversationId = created.rows[0].id as string;
  }

  let promptTokens = 0, completionTokens = 0;

  // 3. follow-up handling: make the question standalone before searching
  let standalone = p.question;
  if (history.length > 0) {
    const r = await complete(buildRewriteMessages(p.question, history), { maxTokens: 120 });
    standalone = r.content || p.question;
    promptTokens += r.promptTokens; completionTokens += r.completionTokens;
  }

  // 4. embed + retrieve; drop weak matches
  const [queryVector] = await embed([standalone]);
  const chunks = (await retrieve(queryVector, p.userId, p.collectionId, env.TOP_K)).filter((c) => c.score >= env.MIN_SIMILARITY);

  // 5. generate (skip the LLM entirely if nothing relevant was found)
  let answer = NO_INFO;
  let citations: unknown[] = [];
  if (chunks.length > 0) {
    const r = await complete(buildMessages(standalone, chunks, history));
    answer = r.content || NO_INFO;
    promptTokens += r.promptTokens; completionTokens += r.completionTokens;

    // keep only sources the model actually cited; if it cited none, show all retrieved
    const used = new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
    const picked = chunks.map((c, i) => ({ c, n: i + 1 })).filter(({ n }) => used.size === 0 || used.has(n));
    citations = answer === NO_INFO ? [] : picked.map(({ c, n }) => ({
      index: n, documentId: c.documentId, filename: c.filename, page: c.page,
      excerpt: c.content.slice(0, 300), score: Number(c.score.toFixed(4)),
    }));
  }

  const latencyMs = Date.now() - t0;

  // 6. persist both messages
  await pool.query("INSERT INTO messages (conversation_id, role, content) VALUES ($1,'user',$2)", [conversationId, p.question]);
  const saved = await pool.query(
    `INSERT INTO messages (conversation_id, role, content, citations, cache_status, latency_ms, prompt_tokens, completion_tokens)
     VALUES ($1,'assistant',$2,$3,'none',$4,$5,$6) RETURNING id`,
    [conversationId, answer, JSON.stringify(citations), latencyMs, promptTokens, completionTokens]
  );

  return {
    conversationId, messageId: saved.rows[0].id as string, answer, citations,
    cacheStatus: "none", standaloneQuestion: standalone,
    latencyMs, usage: { promptTokens, completionTokens },
  };
}

export async function listConversations(userId: string) {
  const { rows } = await pool.query(
    "SELECT id, collection_id, title, created_at FROM conversations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100", [userId]
  );
  return rows;
}

export async function getConversation(userId: string, id: string) {
  const conv = await pool.query("SELECT id, collection_id, title, created_at FROM conversations WHERE id=$1 AND user_id=$2", [id, userId]);
  if (!conv.rows[0]) throw new AppError(404, "Conversation not found");
  const msgs = await pool.query(
    "SELECT id, role, content, citations, cache_status, latency_ms, created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at", [id]
  );
  return { ...conv.rows[0], messages: msgs.rows };
}

export async function deleteConversation(userId: string, id: string) {
  const r = await pool.query("DELETE FROM conversations WHERE id=$1 AND user_id=$2", [id, userId]);
  if (!r.rowCount) throw new AppError(404, "Conversation not found");
}
