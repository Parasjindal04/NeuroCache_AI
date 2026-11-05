import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  LLM_API_KEY: z.string().min(1),
  LLM_BASE_URL: z.url().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIM: z.coerce.number().default(1536),

  CHUNK_SIZE: z.coerce.number().default(1000),
  CHUNK_OVERLAP: z.coerce.number().default(150),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  TOP_K: z.coerce.number().default(5),
  MIN_SIMILARITY: z.coerce.number().default(0.25),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
export const env = parsed.data;
