import fs from "fs";
import path from "path";
import { pool } from "./postgres";

// Tiny migration runner: applies each .sql file in ./migrations once, in filename order.
async function run() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
  );
  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const done = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (done.rowCount) continue;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  console.log("migrations up to date");
  await pool.end();
}

run().catch((e) => {
  console.error("migration failed:", e);
  process.exit(1);
});
