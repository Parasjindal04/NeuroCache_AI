import { Router } from "express";
import { redis } from "../cache/redisClient";
import { pool } from "../db/postgres";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const result = { postgres: false, pgvector: false, redis: false, redisSearch: false };
  try {
    const r = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    result.postgres = true;
    result.pgvector = r.rowCount === 1;
  } catch {}
  try {
    await redis.ping();
    result.redis = true;
    await redis.call("FT._LIST"); // errors if the RediSearch module isn't loaded
    result.redisSearch = true;
  } catch {}
  const ok = Object.values(result).every(Boolean);
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", ...result });
});
