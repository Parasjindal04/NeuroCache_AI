import { Router } from "express";
import fs from "fs/promises";
import { z } from "zod";
import { pool } from "../../db/postgres";
import { requireAuth } from "../../middleware/auth";
import { AppError, asyncHandler } from "../../middleware/errors";

export const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

collectionsRouter.post("/", asyncHandler(async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
  const { rows } = await pool.query(
    "INSERT INTO collections (user_id, name) VALUES ($1, $2) RETURNING id, name, kb_version, created_at",
    [req.user!.id, name]
  );
  res.status(201).json({ collection: rows[0] });
}));

collectionsRouter.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.kb_version, c.created_at, COUNT(d.id)::int AS document_count
     FROM collections c LEFT JOIN documents d ON d.collection_id = c.id
     WHERE c.user_id = $1 GROUP BY c.id ORDER BY c.created_at DESC`,
    [req.user!.id]
  );
  res.json({ collections: rows });
}));

collectionsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  // collect file paths first; DB rows are removed by ON DELETE CASCADE
  const files = await pool.query("SELECT stored_path FROM documents WHERE collection_id=$1 AND user_id=$2", [id, req.user!.id]);
  const del = await pool.query("DELETE FROM collections WHERE id=$1 AND user_id=$2", [id, req.user!.id]);
  if (!del.rowCount) throw new AppError(404, "Collection not found");
  await Promise.all(files.rows.map((f) => fs.unlink(f.stored_path).catch(() => {})));
  res.status(204).end();
}));
