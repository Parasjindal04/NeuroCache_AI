import { Pool } from "pg";
import { env } from "../config/env";

// A pool keeps several connections open and reuses them (much faster than reconnecting per query).
export const pool = new Pool({ connectionString: env.DATABASE_URL });

// pgvector accepts vectors as text like '[0.1,0.2,0.3]'. We always pass it as a parameter and
// cast with $n::vector in SQL, so values are never concatenated into the query string.
export const toVector = (v: number[]): string => `[${v.join(",")}]`;
