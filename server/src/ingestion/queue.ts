import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env";

// BullMQ requires maxRetriesPerRequest: null (it uses blocking Redis commands).
export const queueConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
queueConnection.on("error", () => {});

export interface IngestionJob {
  documentId: string;
  chunkSize: number;
  chunkOverlap: number;
}

export const ingestionQueue = new Queue<IngestionJob>("ingestion", {
  connection: queueConnection,
  defaultJobOptions: { attempts: 2, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: 100, removeOnFail: 200 },
});
