import { Router } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { env } from "../../config/env";
import { pool } from "../../db/postgres";
import { ingestionQueue } from "../../ingestion/queue";
import { requireAuth } from "../../middleware/auth";
import { AppError, asyncHandler } from "../../middleware/errors";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const UPLOAD_DIR = path.resolve(__dirname, "../../../uploads");
const TYPES: Record<string, "pdf" | "docx" | "txt"> = { ".pdf": "pdf", ".docx": "docx", ".txt": "txt" };

const upload = multer({
  // Files are saved under a random name, never the user's filename (prevents path tricks / overwrites).
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    TYPES[path.extname(file.originalname).toLowerCase()] ? cb(null, true) : cb(new AppError(400, "Only PDF, DOCX and TXT files are allowed")),
});

// Check real file content ("magic bytes"), because extensions can be faked.
async function looksValid(filePath: string, type: "pdf" | "docx" | "txt"): Promise<boolean> {
  const fh = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(8);
    await fh.read(buf, 0, 8, 0);
    if (type === "pdf") return buf.subarray(0, 4).toString() === "%PDF";
    if (type === "docx") return buf[0] === 0x50 && buf[1] === 0x4b; // "PK" = zip container
    return !buf.includes(0); // txt: no NUL bytes
  } finally {
    await fh.close();
  }
}

const chunkOpts = z.object({
  chunkSize: z.coerce.number().int().min(200).max(4000).optional(),
  chunkOverlap: z.coerce.number().int().min(0).max(1000).optional(),
});

const COLUMNS = "id, collection_id, filename, file_type, size_bytes, status, error_message, page_count, chunk_count, chunk_size, chunk_overlap, version, created_at, updated_at";

documentsRouter.post("/upload", upload.single("file"), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new AppError(400, "No file uploaded (field name must be 'file')");
  const discard = () => fs.unlink(file.path).catch(() => {});

  try {
    const collectionId = z.uuid().parse(req.body.collectionId);
    const opts = chunkOpts.parse(req.body);
    const type = TYPES[path.extname(file.originalname).toLowerCase()];

    const owned = await pool.query("SELECT 1 FROM collections WHERE id=$1 AND user_id=$2", [collectionId, req.user!.id]);
    if (!owned.rowCount) throw new AppError(404, "Collection not found");
    if (!(await looksValid(file.path, type))) throw new AppError(400, "File content does not match its type");

    const chunkSize = opts.chunkSize ?? env.CHUNK_SIZE;
    const chunkOverlap = opts.chunkOverlap ?? env.CHUNK_OVERLAP;
    const { rows } = await pool.query(
      `INSERT INTO documents (user_id, collection_id, filename, stored_path, file_type, size_bytes, chunk_size, chunk_overlap)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLUMNS}`,
      [req.user!.id, collectionId, path.basename(file.originalname).slice(0, 200), file.path, type, file.size, chunkSize, chunkOverlap]
    );
    await ingestionQueue.add("ingest", { documentId: rows[0].id, chunkSize, chunkOverlap });
    res.status(202).json({ document: rows[0] }); // 202 = accepted, processing continues in background
  } catch (err) {
    await discard();
    throw err;
  }
}));

documentsRouter.get("/", asyncHandler(async (req, res) => {
  const collectionId = req.query.collectionId ? z.uuid().parse(req.query.collectionId) : null;
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM documents WHERE user_id=$1 AND ($2::uuid IS NULL OR collection_id=$2) ORDER BY created_at DESC`,
    [req.user!.id, collectionId]
  );
  res.json({ documents: rows });
}));

documentsRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM documents WHERE id=$1 AND user_id=$2`, [id, req.user!.id]);
  if (!rows[0]) throw new AppError(404, "Document not found");
  res.json({ document: rows[0] });
}));

documentsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const { rows } = await pool.query(
    "DELETE FROM documents WHERE id=$1 AND user_id=$2 RETURNING stored_path, collection_id", [id, req.user!.id]
  );
  if (!rows[0]) throw new AppError(404, "Document not found");
  await pool.query("UPDATE collections SET kb_version = kb_version + 1 WHERE id=$1", [rows[0].collection_id]);
  await fs.unlink(rows[0].stored_path).catch(() => {});
  res.status(204).end();
}));

// Re-run ingestion on the stored file, optionally with different chunk settings (for chunking experiments).
documentsRouter.post("/:id/reprocess", asyncHandler(async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const opts = chunkOpts.parse(req.body ?? {});
  const { rows } = await pool.query("SELECT chunk_size, chunk_overlap, status FROM documents WHERE id=$1 AND user_id=$2", [id, req.user!.id]);
  if (!rows[0]) throw new AppError(404, "Document not found");
  if (rows[0].status === "processing") throw new AppError(409, "Document is already being processed");

  const chunkSize = opts.chunkSize ?? rows[0].chunk_size;
  const chunkOverlap = opts.chunkOverlap ?? rows[0].chunk_overlap;
  const upd = await pool.query(
    `UPDATE documents SET status='queued', version=version+1, updated_at=now() WHERE id=$1 RETURNING ${COLUMNS}`, [id]
  );
  await ingestionQueue.add("ingest", { documentId: id, chunkSize, chunkOverlap });
  res.status(202).json({ document: upd.rows[0] });
}));
