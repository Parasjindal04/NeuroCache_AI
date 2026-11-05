import { Pool } from "pg";
import { env } from "../config/env";

// A pool keeps several connections open and reuses them (much faster than reconnecting per query).
// Settings are tuned for a low-RAM laptop and for serverless Postgres (e.g. Neon), which suspends
// when idle and drops connections: short idle timeout + generous connect timeout (cold start).
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
});

// Without this handler, a dropped idle connection emits an unhandled 'error' event and crashes Node.
pool.on("error", (err) => console.error("[pg] idle client error:", err.message));

// pgvector accepts vectors as text like '[0.1,0.2,0.3]'. We always pass it as a parameter and
// cast with $n::vector in SQL, so values are never concatenated into the query string.
export const toVector = (v: number[]): string => `[${v.join(",")}]`;
