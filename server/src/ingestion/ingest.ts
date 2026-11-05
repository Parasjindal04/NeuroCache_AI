import { pool, toVector } from "../db/postgres";
import { embed } from "../llm/provider";
import { chunkText } from "./chunker";
import { cleanText } from "./cleaner";
import { parseFile } from "./parsers";

const EMBED_BATCH = 64;

// The whole ingestion pipeline for one document. Called by the background worker.
export async function ingestDocument(documentId: string, chunkSize: number, chunkOverlap: number) {
  const { rows } = await pool.query("SELECT * FROM documents WHERE id = $1", [documentId]);
  const doc = rows[0];
  if (!doc) return; // deleted while queued

  await pool.query("UPDATE documents SET status='processing', error_message=NULL, updated_at=now() WHERE id=$1", [documentId]);

  try {
    // 1-2. extract + clean (per page, so page numbers survive)
    const pages = (await parseFile(doc.stored_path, doc.file_type))
      .map((p) => ({ ...p, text: cleanText(p.text) }))
      .filter((p) => p.text.length > 0);
    if (pages.length === 0) throw new Error("No extractable text found (scanned PDF? OCR is not supported)");

    // 3. chunk each page separately
    const chunks: { content: string; page: number | null }[] = [];
    for (const page of pages) {
      for (const content of chunkText(page.text, chunkSize, chunkOverlap)) chunks.push({ content, page: page.pageNumber });
    }

    // 4. embed in batches
    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      vectors.push(...(await embed(chunks.slice(i, i + EMBED_BATCH).map((c) => c.content))));
    }

    // 5. replace old chunks + insert new ones atomically, bump kb_version, mark ready
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM document_chunks WHERE document_id = $1", [documentId]);
      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          `INSERT INTO document_chunks (document_id, chunk_index, content, page_number, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5::vector, $6)`,
          [documentId, i, chunks[i].content, chunks[i].page, toVector(vectors[i]), JSON.stringify({ chunkSize, chunkOverlap })]
        );
      }
      await client.query(
        `UPDATE documents SET status='ready', page_count=$2, chunk_count=$3, chunk_size=$4, chunk_overlap=$5, updated_at=now() WHERE id=$1`,
        [documentId, pages.length, chunks.length, chunkSize, chunkOverlap]
      );
      await client.query("UPDATE collections SET kb_version = kb_version + 1 WHERE id = $1", [doc.collection_id]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    await pool.query("UPDATE documents SET status='failed', error_message=$2, updated_at=now() WHERE id=$1", [documentId, String(err.message).slice(0, 500)]);
    throw err; // lets BullMQ apply its retry policy
  }
}
