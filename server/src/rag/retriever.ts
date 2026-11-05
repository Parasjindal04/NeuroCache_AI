import { pool, toVector } from "../db/postgres";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  filename: string;
  page: number | null;
  content: string;
  score: number; // cosine similarity: 1 = identical direction, 0 = unrelated
}

// Vector search. `<=>` is pgvector's cosine DISTANCE, so similarity = 1 - distance.
// Security: the WHERE clause restricts results to this user's documents in this collection.
export async function retrieve(queryVector: number[], userId: string, collectionId: string, topK: number): Promise<RetrievedChunk[]> {
  const { rows } = await pool.query(
    `SELECT c.id AS chunk_id, c.content, c.page_number, d.id AS document_id, d.filename,
            1 - (c.embedding <=> $1::vector) AS score
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.user_id = $2 AND d.collection_id = $3 AND d.status = 'ready'
     ORDER BY c.embedding <=> $1::vector
     LIMIT $4`,
    [toVector(queryVector), userId, collectionId, topK]
  );
  return rows.map((r) => ({
    chunkId: r.chunk_id, documentId: r.document_id, filename: r.filename,
    page: r.page_number, content: r.content, score: Number(r.score),
  }));
}
